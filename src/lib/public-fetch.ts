import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http, { type IncomingHttpHeaders, type IncomingMessage } from "node:http";
import https from "node:https";
import { BlockList, isIP, isIPv4, isIPv6, type LookupFunction } from "node:net";

/**
 * Guarded downloader for user-supplied URLs (server-side request forgery
 * defence). Every request:
 *
 * - allows only http/https on the scheme's default port, with no credentials;
 * - rejects literal IPs and DNS answers in loopback, private, link-local
 *   (cloud metadata), CGNAT, multicast, reserved and IPv6 local ranges,
 *   including IPv4-mapped / NAT64 / 6to4 forms of those addresses;
 * - checks addresses inside the socket's own `lookup`, so the address that
 *   was validated is the one connected to (no DNS-rebinding gap);
 * - follows at most `maxRedirects` redirects by hand, re-checking each hop;
 * - stops reading as soon as the body passes `maxBytes`.
 *
 * Callers should map every reason except "too-large" and "aborted" to one
 * generic message, so the error does not reveal which internal hosts answer.
 */

export type PublicFetchFailure =
  | "invalid-url"
  | "blocked"
  | "unreachable"
  | "http-status"
  | "too-many-redirects"
  | "too-large"
  | "rejected-content"
  | "aborted";

export class PublicFetchError extends Error {
  readonly reason: PublicFetchFailure;

  constructor(reason: PublicFetchFailure, message: string = reason) {
    super(message);
    this.name = "PublicFetchError";
    this.reason = reason;
  }
}

export type PublicDownload = {
  bytes: Uint8Array;
  finalUrl: URL;
  headers: IncomingHttpHeaders;
  status: number;
};

export type PublicDownloadOptions = {
  headers?: Record<string, string>;
  maxBytes: number;
  /** Redirect hops to follow before failing. Defaults to 3. */
  maxRedirects?: number;
  /**
   * Checks the first `length` body bytes as soon as they arrive, so a
   * response that is plainly the wrong type is dropped without downloading it.
   */
  prefixCheck?: { length: number; accept: (prefix: Uint8Array) => boolean };
  signal?: AbortSignal;
};

// ---------------------------------------------------------------------------
// Address policy
// ---------------------------------------------------------------------------

const BLOCKED_IPV4_SUBNETS: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // RFC1918
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12], // RFC1918
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // RFC1918
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

const BLOCKED_IPV6_SUBNETS: ReadonlyArray<readonly [string, number]> = [
  ["::", 96], // unspecified, loopback, deprecated IPv4-compatible
  ["100::", 64], // discard-only
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // deprecated site-local
  ["ff00::", 8], // multicast
];

const blockList = new BlockList();

for (const [network, prefix] of BLOCKED_IPV4_SUBNETS) {
  blockList.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of BLOCKED_IPV6_SUBNETS) {
  blockList.addSubnet(network, prefix, "ipv6");
}

/** Expands an IPv6 literal into its eight 16-bit groups, or null when invalid. */
function expandIpv6(address: string): number[] | null {
  let value = address.split("%")[0];

  if (!isIPv6(value)) {
    return null;
  }

  // Replace a trailing dotted quad with two hex groups.
  const dottedQuad = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(value);

  if (dottedQuad) {
    const [a, b, c, d] = dottedQuad.slice(1).map(Number);
    value = `${value.slice(0, dottedQuad.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const [head, tail] = value.includes("::") ? value.split("::") : [value, undefined];
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const fill = tail === undefined ? 0 : 8 - headGroups.length - tailGroups.length;
  const groups = [...headGroups, ...Array<string>(fill).fill("0"), ...tailGroups].map((group) =>
    Number.parseInt(group, 16),
  );

  return groups.length === 8 && groups.every((group) => Number.isInteger(group)) ? groups : null;
}

function ipv4FromGroups(high: number, low: number) {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

/**
 * Returns the IPv4 address embedded in an IPv4-mapped (::ffff:0:0/96),
 * IPv4-translated (::ffff:0:0:0/96), NAT64 (64:ff9b::/96) or 6to4
 * (2002::/16) IPv6 address, so it can be checked against the IPv4 rules.
 */
function embeddedIpv4(groups: number[]): string | null {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;

  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return ipv4FromGroups(g6, g7);
  }

  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0xffff && g5 === 0) {
    return ipv4FromGroups(g6, g7);
  }

  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return ipv4FromGroups(g6, g7);
  }

  if (g0 === 0x2002) {
    return ipv4FromGroups(g1, g2);
  }

  return null;
}

/**
 * True when `address` (an IPv4 or IPv6 literal, brackets allowed) must never
 * be fetched. Anything that is not a valid IP literal is treated as blocked.
 */
export function isBlockedAddress(address: string): boolean {
  const literal = address.replace(/^\[(.*)\]$/, "$1");

  if (isIPv4(literal)) {
    return blockList.check(literal, "ipv4");
  }

  const groups = expandIpv6(literal);

  if (!groups) {
    return true;
  }

  const mapped = embeddedIpv4(groups);

  if (mapped !== null && blockList.check(mapped, "ipv4")) {
    return true;
  }

  return blockList.check(groups.map((group) => group.toString(16)).join(":"), "ipv6");
}

export type AddressPolicy = {
  /** Allow explicit non-default ports. Only for tests against local servers. */
  allowAnyPort?: boolean;
  isBlockedAddress: (address: string) => boolean;
};

const DEFAULT_POLICY: AddressPolicy = { isBlockedAddress };

const DEFAULT_PORTS: Record<string, string> = { "http:": "80", "https:": "443" };

/**
 * Parses and checks a URL before any connection is made. `new URL` already
 * normalises decimal, octal and hex IPv4 hosts (http://2130706433/ becomes
 * 127.0.0.1), so the literal check sees the canonical form.
 */
export function assertPublicHttpUrl(
  input: string | URL,
  policy: AddressPolicy = DEFAULT_POLICY,
): URL {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new PublicFetchError("invalid-url");
  }

  if (!(url.protocol in DEFAULT_PORTS)) {
    throw new PublicFetchError("invalid-url");
  }

  if (url.username !== "" || url.password !== "") {
    throw new PublicFetchError("blocked");
  }

  // URL drops a port that equals the scheme default, so any port left is non-default.
  if (url.port !== "" && url.port !== DEFAULT_PORTS[url.protocol] && !policy.allowAnyPort) {
    throw new PublicFetchError("blocked");
  }

  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");

  if (host.length === 0) {
    throw new PublicFetchError("invalid-url");
  }

  if (isIP(host) !== 0 && policy.isBlockedAddress(host)) {
    throw new PublicFetchError("blocked");
  }

  return url;
}

/**
 * A `net` lookup that resolves every address for the host and fails when any
 * of them is blocked. It honours both the single-address and `all: true`
 * callback shapes that Node's socket code uses.
 */
export function createGuardedLookup(policy: AddressPolicy = DEFAULT_POLICY): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(
      hostname,
      { all: true, family: options.family, hints: options.hints },
      (error, addresses: LookupAddress[]) => {
        if (error) {
          callback(error, "", 0);
          return;
        }

        if (
          addresses.length === 0 ||
          addresses.some((entry) => policy.isBlockedAddress(entry.address))
        ) {
          callback(new PublicFetchError("blocked"), "", 0);
          return;
        }

        if (options.all) {
          (callback as unknown as (err: null, all: LookupAddress[]) => void)(null, addresses);
          return;
        }

        callback(null, addresses[0].address, addresses[0].family);
      },
    );
  };
}

// ---------------------------------------------------------------------------
// Body reading
// ---------------------------------------------------------------------------

/**
 * Collects a byte stream into one array, failing with "too-large" as soon as
 * the running total passes `maxBytes`. When `onLimit` is given it is called
 * first, so the caller can destroy the underlying socket or stream.
 */
export async function collectBytesWithLimit(
  source: AsyncIterable<Uint8Array>,
  maxBytes: number,
  options: {
    onLimit?: () => void;
    prefixCheck?: PublicDownloadOptions["prefixCheck"];
  } = {},
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let prefixChecked = options.prefixCheck === undefined;

  for await (const chunk of source) {
    total += chunk.byteLength;

    if (total > maxBytes) {
      options.onLimit?.();
      throw new PublicFetchError("too-large");
    }

    chunks.push(chunk);

    if (!prefixChecked && options.prefixCheck && total >= options.prefixCheck.length) {
      prefixChecked = true;

      if (!options.prefixCheck.accept(concatBytes(chunks, total).subarray(0, options.prefixCheck.length))) {
        options.onLimit?.();
        throw new PublicFetchError("rejected-content");
      }
    }
  }

  return concatBytes(chunks, total);
}

function concatBytes(chunks: Uint8Array[], total: number) {
  const combined = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return combined;
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_MAX_REDIRECTS = 3;

function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

function requestOnce(
  url: URL,
  options: PublicDownloadOptions,
  lookup: LookupFunction,
): Promise<IncomingMessage> {
  const transport = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(url, {
      agent: false,
      headers: options.headers,
      lookup,
      method: "GET",
      signal: options.signal,
    });

    request.once("response", resolve);
    request.once("error", (error) => {
      if (error instanceof PublicFetchError) {
        reject(error);
      } else if (options.signal?.aborted || isAbortError(error)) {
        reject(new PublicFetchError("aborted"));
      } else {
        reject(new PublicFetchError("unreachable"));
      }
    });
    request.end();
  });
}

export function createPublicDownloader(policy: AddressPolicy = DEFAULT_POLICY) {
  const lookup = createGuardedLookup(policy);

  return async function downloadPublicUrl(
    input: string | URL,
    options: PublicDownloadOptions,
  ): Promise<PublicDownload> {
    const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    let url = assertPublicHttpUrl(input, policy);

    for (let hop = 0; ; hop += 1) {
      if (options.signal?.aborted) {
        throw new PublicFetchError("aborted");
      }

      const response = await requestOnce(url, options, lookup);
      const status = response.statusCode ?? 0;

      if (REDIRECT_STATUSES.has(status) && response.headers.location) {
        response.destroy();

        if (hop >= maxRedirects) {
          throw new PublicFetchError("too-many-redirects");
        }

        let next: URL;

        try {
          next = new URL(response.headers.location, url);
        } catch {
          throw new PublicFetchError("invalid-url");
        }

        url = assertPublicHttpUrl(next, policy);
        continue;
      }

      if (status < 200 || status >= 300) {
        response.destroy();
        throw new PublicFetchError("http-status");
      }

      const declared = Number(response.headers["content-length"]);

      if (Number.isFinite(declared) && declared > options.maxBytes) {
        response.destroy();
        throw new PublicFetchError("too-large");
      }

      try {
        const bytes = await collectBytesWithLimit(response, options.maxBytes, {
          onLimit: () => response.destroy(),
          prefixCheck: options.prefixCheck,
        });

        return { bytes, finalUrl: url, headers: response.headers, status };
      } catch (error) {
        response.destroy();

        if (error instanceof PublicFetchError) {
          throw error;
        }

        throw new PublicFetchError(
          options.signal?.aborted || isAbortError(error) ? "aborted" : "unreachable",
        );
      }
    }
  };
}

/** The production downloader, using the default public-address policy. */
export const downloadPublicUrl = createPublicDownloader();
