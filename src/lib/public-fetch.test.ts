import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import {
  assertPublicHttpUrl,
  collectBytesWithLimit,
  createGuardedLookup,
  createPublicDownloader,
  downloadPublicUrl,
  isBlockedAddress,
  PublicFetchError,
} from "./public-fetch";

function reasonOf(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    return error instanceof PublicFetchError ? error.reason : "other";
  }

  return "ok";
}

async function reasonOfAsync(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error instanceof PublicFetchError ? error.reason : `other: ${String(error)}`;
  }

  return "ok";
}

describe("isBlockedAddress", () => {
  it.each([
    "0.0.0.0",
    "10.1.2.3",
    "100.64.0.1",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "[::1]",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "fe80::1%en0",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "::ffff:10.0.0.1",
    "64:ff9b::a9fe:a9fe",
    "2002:7f00:1::",
    "not-an-ip",
  ])("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.32.0.1",
    "100.128.0.1",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
    "64:ff9b::808:808",
  ])("allows %s", (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

describe("assertPublicHttpUrl", () => {
  it("accepts public http(s) URLs on default ports", () => {
    expect(assertPublicHttpUrl("https://www.ti.com/lit/ds/symlink/lm358.pdf").hostname).toBe(
      "www.ti.com",
    );
    expect(reasonOf(() => assertPublicHttpUrl("http://example.com:80/a.pdf"))).toBe("ok");
    expect(reasonOf(() => assertPublicHttpUrl("https://example.com:443/a.pdf"))).toBe("ok");
    expect(reasonOf(() => assertPublicHttpUrl("https://8.8.8.8/a.pdf"))).toBe("ok");
  });

  it("rejects other schemes and malformed URLs", () => {
    expect(reasonOf(() => assertPublicHttpUrl("ftp://example.com/a.pdf"))).toBe("invalid-url");
    expect(reasonOf(() => assertPublicHttpUrl("file:///etc/passwd"))).toBe("invalid-url");
    expect(reasonOf(() => assertPublicHttpUrl("not a url"))).toBe("invalid-url");
  });

  it("rejects non-default ports and credentials", () => {
    expect(reasonOf(() => assertPublicHttpUrl("http://example.com:8080/a.pdf"))).toBe("blocked");
    expect(reasonOf(() => assertPublicHttpUrl("https://example.com:80/a.pdf"))).toBe("blocked");
    expect(reasonOf(() => assertPublicHttpUrl("https://user:pw@example.com/a.pdf"))).toBe(
      "blocked",
    );
  });

  it("rejects internal IP literals, including forms new URL normalises", () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://2130706433/", // decimal 127.0.0.1
      "http://0x7f.1/", // hex/short 127.0.0.1
      "http://0177.0.0.1/", // octal 127.0.0.1
      "http://169.254.169.254/latest/meta-data/",
      "http://0xa9fea9fe/", // hex 169.254.169.254
      "http://0/",
      "http://[::1]/",
      "http://[::ffff:127.0.0.1]/",
      "http://[::ffff:a9fe:a9fe]/",
      "http://[fe80::1]/",
    ]) {
      expect(reasonOf(() => assertPublicHttpUrl(url)), url).toBe("blocked");
    }
  });
});

describe("createGuardedLookup", () => {
  it("rejects a hostname that resolves to loopback", async () => {
    const lookup = createGuardedLookup();
    const error = await new Promise<unknown>((resolve) => {
      lookup("localhost", { all: true }, (err) => resolve(err));
    });

    expect(error).toBeInstanceOf(PublicFetchError);
    expect((error as PublicFetchError).reason).toBe("blocked");
  });
});

describe("collectBytesWithLimit", () => {
  async function* chunks(...sizes: number[]) {
    for (const size of sizes) {
      yield new Uint8Array(size).fill(0x25);
    }
  }

  it("concatenates chunks under the limit", async () => {
    const bytes = await collectBytesWithLimit(chunks(3, 4), 10);

    expect(bytes.byteLength).toBe(7);
  });

  it("stops at the first chunk that passes the limit", async () => {
    let limitHit = false;
    const reason = await reasonOfAsync(
      collectBytesWithLimit(chunks(6, 6, 6), 10, { onLimit: () => (limitHit = true) }),
    );

    expect(reason).toBe("too-large");
    expect(limitHit).toBe(true);
  });

  it("checks the prefix across chunk boundaries", async () => {
    async function* split() {
      yield new TextEncoder().encode("%P");
      yield new TextEncoder().encode("DF-1.7");
    }
    async function* html() {
      yield new TextEncoder().encode("<!DOCTYPE html>");
    }
    const prefixCheck = {
      accept: (prefix: Uint8Array) => new TextDecoder().decode(prefix) === "%PDF-",
      length: 5,
    };

    expect((await collectBytesWithLimit(split(), 100, { prefixCheck })).byteLength).toBe(8);
    expect(await reasonOfAsync(collectBytesWithLimit(html(), 100, { prefixCheck }))).toBe(
      "rejected-content",
    );
  });
});

describe("downloadPublicUrl", () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.closeAllConnections();
            server.close(() => resolve());
          }),
      ),
    );
  });

  async function listen(handler: http.RequestListener) {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  // Loopback is the only way to host a test server, so the test policy allows
  // exactly 127.0.0.1 on any port and keeps every other default rule.
  const testDownload = createPublicDownloader({
    allowAnyPort: true,
    isBlockedAddress: (address) => address !== "127.0.0.1" && isBlockedAddress(address),
  });

  it("refuses loopback under the default policy before connecting", async () => {
    let hits = 0;
    const origin = await listen((_req, res) => {
      hits += 1;
      res.end("%PDF-1.7");
    });

    expect(await reasonOfAsync(downloadPublicUrl(origin, { maxBytes: 1024 }))).toBe("blocked");
    expect(await reasonOfAsync(downloadPublicUrl("http://localhost/", { maxBytes: 1024 }))).toBe(
      "blocked",
    );
    expect(hits).toBe(0);
  });

  it("downloads a small body", async () => {
    const origin = await listen((_req, res) => res.end("%PDF-1.7 hello"));
    const result = await testDownload(`${origin}/a.pdf`, { maxBytes: 1024 });

    expect(new TextDecoder().decode(result.bytes)).toBe("%PDF-1.7 hello");
    expect(result.status).toBe(200);
  });

  it("follows a relative redirect and reports the final URL", async () => {
    const origin = await listen((req, res) => {
      if (req.url === "/start") {
        res.writeHead(302, { location: "/final.pdf" }).end();
      } else {
        res.end("%PDF-ok");
      }
    });
    const result = await testDownload(`${origin}/start`, { maxBytes: 1024 });

    expect(result.finalUrl.pathname).toBe("/final.pdf");
  });

  it("re-checks every redirect target", async () => {
    const origin = await listen((req, res) => {
      const targets: Record<string, string> = {
        "/metadata": "http://169.254.169.254/latest/meta-data/",
        "/private": "http://10.0.0.5/",
        "/mapped": "http://[::ffff:127.0.0.1]:3000/",
        "/port": "http://example.com:8080/",
      };
      res.writeHead(302, { location: targets[req.url ?? ""] ?? "/" }).end();
    });

    for (const path of ["/metadata", "/private", "/mapped"]) {
      expect(await reasonOfAsync(testDownload(`${origin}${path}`, { maxBytes: 1024 })), path).toBe(
        "blocked",
      );
    }

    // The default policy rejects non-default ports on a redirect hop too.
    expect(reasonOf(() => assertPublicHttpUrl("http://example.com:8080/"))).toBe("blocked");
  });

  it("stops after three redirect hops", async () => {
    const origin = await listen((req, res) => {
      const step = Number(req.url?.slice(1) ?? 0);
      res.writeHead(302, { location: `/${step + 1}` }).end();
    });

    expect(await reasonOfAsync(testDownload(`${origin}/0`, { maxBytes: 1024 }))).toBe(
      "too-many-redirects",
    );
  });

  it("fails on non-2xx status without reading the body", async () => {
    const origin = await listen((_req, res) => res.writeHead(404).end("missing"));

    expect(await reasonOfAsync(testDownload(origin, { maxBytes: 1024 }))).toBe("http-status");
  });

  it("rejects a declared content-length over the limit", async () => {
    const origin = await listen((_req, res) => {
      res.writeHead(200, { "content-length": "4096" });
      res.end(Buffer.alloc(4096));
    });

    expect(await reasonOfAsync(testDownload(origin, { maxBytes: 1024 }))).toBe("too-large");
  });

  it("aborts a chunked body as soon as it passes the limit", async () => {
    const maxBytes = 64 * 1024;
    const chunk = Buffer.alloc(16 * 1024, 0x25);
    const planned = 64 * 1024 * 1024;
    let written = 0;
    let closedEarly = false;

    const origin = await listen((_req, res) => {
      res.writeHead(200, { "content-type": "application/pdf" });
      res.on("close", () => {
        closedEarly = written < planned;
      });

      const pump = () => {
        while (written < planned && !res.destroyed) {
          written += chunk.byteLength;

          if (!res.write(chunk)) {
            res.once("drain", pump);
            return;
          }
        }

        if (!res.destroyed) {
          res.end();
        }
      };

      pump();
    });

    expect(await reasonOfAsync(testDownload(origin, { maxBytes }))).toBe("too-large");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(closedEarly).toBe(true);
    expect(written).toBeLessThan(planned);
  });

  it("drops a non-matching body once the prefix arrives", async () => {
    const origin = await listen((_req, res) => res.end("<!DOCTYPE html><html></html>"));

    expect(
      await reasonOfAsync(
        testDownload(origin, {
          maxBytes: 1024,
          prefixCheck: {
            accept: (prefix) => new TextDecoder().decode(prefix) === "%PDF-",
            length: 5,
          },
        }),
      ),
    ).toBe("rejected-content");
  });

  it("maps an aborted signal to aborted", async () => {
    const origin = await listen(() => {
      // Never responds.
    });
    const controller = new AbortController();
    const pending = testDownload(origin, { maxBytes: 1024, signal: controller.signal });

    setTimeout(() => controller.abort(), 20);
    expect(await reasonOfAsync(pending)).toBe("aborted");
  });

  it("maps a refused connection to unreachable", async () => {
    const origin = await listen(() => undefined);
    const server = servers.pop()!;
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(await reasonOfAsync(testDownload(origin, { maxBytes: 1024 }))).toBe("unreachable");
  });
});
