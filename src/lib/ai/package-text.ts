import type { PackageCategory } from "@/lib/package-categories";

/**
 * Facts read from a package description such as "48-Pin TQFN 6mm x 6mm with
 * exposed pad" or "SOT23 (TO-236AB), 3 leads". Pure and client-safe; used by
 * the extraction rules and the review checks.
 */

export type PackageCodeFamily =
  | "bga"
  | "dip"
  | "noLead"
  | "plcc"
  | "quadFlat"
  | "smallOutline"
  | "smaSmbSmc"
  | "sod"
  | "sot223"
  | "sot23";

const CODE_FAMILY_PATTERNS: ReadonlyArray<readonly [PackageCodeFamily, RegExp]> = [
  ["sot223", /\bSOT-?223\b|\bTO-?261\b/i],
  // "SOT-23-THIN" is TI's name for a small-outline package, not a SOT23.
  ["sot23", /\bSOT-?23(?!-?THIN)(?!\d)|\bTO-?236\b/i],
  ["smallOutline", /\b(?:SOIC|SOP|SSOP|TSSOP|HTSSOP|MSOP|VSSOP|QSOP|TSOP)(?:-?\d+)?|\bSO-\d/i],
  ["quadFlat", /\b(?:LQFP|TQFP|PQFP|HTQFP|QFP)(?:-?\d+)?\b/i],
  ["noLead", /QFN|DFN|\b[WVUX]?SON\b|LFCSP|\bMLF\b|\bMLP\b/i],
  ["bga", /BGA|WLCSP/i],
  ["plcc", /\bPLCC\b/i],
  ["sod", /\bSOD-?\d+/i],
  ["smaSmbSmc", /\bDO-?214|\bSM[ABC]\b/i],
  ["dip", /\b(?:PDIP|CDIP|DIP)(?:-?\d+)?\b/i],
];

/** Package families each category accepts. Categories not listed are never checked. */
const CATEGORY_CODE_FAMILIES: Partial<Record<PackageCategory, readonly PackageCodeFamily[]>> = {
  BGA: ["bga"],
  "Ceramic Dual-In-Line Packages": ["dip"],
  "Diodes Moulded": ["smaSmbSmc"],
  "Diodes Moulded Non Polarised": ["smaSmbSmc"],
  "Dual-In-Line Packages": ["dip"],
  "Plastic Leaded Chip Carrier": ["plcc"],
  "Quad Flat No-Lead": ["noLead"],
  "Quad Flat Packages": ["quadFlat"],
  "SOT223 (3-Pin)": ["sot223"],
  "SOT223 (4-Pin)": ["sot223"],
  "SOT223 (5-Pin)": ["sot223"],
  "SOT23 (3-Pin)": ["sot23"],
  "SOT23 (5-Pin)": ["sot23"],
  "SOT23 (6-Pin)": ["sot23"],
  "SOT23 (8-Pin)": ["sot23"],
  "Small Outline Diode": ["sod"],
  "Small Outline Diode Flat Lead": ["sod"],
  "Small Outline No-lead": ["noLead"],
  "Small Outline Packages": ["smallOutline"],
};

const PACKAGE_FAMILY_LABELS: Record<PackageCodeFamily, string> = {
  bga: "a BGA",
  dip: "a DIP",
  noLead: "a no-lead package (QFN, DFN or SON)",
  plcc: "a PLCC",
  quadFlat: "a quad flat package (QFP)",
  smaSmbSmc: "an SMA, SMB or SMC diode package",
  smallOutline: "a small-outline package (SOIC, SOP or TSSOP)",
  sod: "a SOD package",
  sot223: "a SOT-223",
  sot23: "a SOT-23",
};

export function detectPackageCodeFamilies(packageText: string): PackageCodeFamily[] {
  return CODE_FAMILY_PATTERNS.filter(([, pattern]) => pattern.test(packageText)).map(
    ([family]) => family,
  );
}

/**
 * A sentence for the review notes when the package the AI found clearly
 * belongs to another category, or null. Only categories with a recognisable
 * package code are checked, and any matching family clears it.
 */
export function describeCategoryMismatch(
  category: PackageCategory,
  packageText: string,
): string | null {
  const accepted = CATEGORY_CODE_FAMILIES[category];

  if (!accepted) {
    return null;
  }

  const found = detectPackageCodeFamilies(packageText);

  if (found.length === 0 || found.some((family) => accepted.includes(family))) {
    return null;
  }

  return `Check the category: the datasheet's package looks like ${PACKAGE_FAMILY_LABELS[found[0]]}, but the category is ${category}.`;
}

const CODE_LIST =
  "SOIC|SOP|SSOP|TSSOP|HTSSOP|MSOP|VSSOP|QSOP|TSOP|QFN|TQFN|VQFN|WQFN|UQFN|DFN|SON|WSON|VSON|LQFP|TQFP|HTQFP|QFP|PLCC|BGA|FBGA|FCBGA|PDIP|DIP|LFCSP";

const PIN_COUNT_PATTERNS: readonly RegExp[] = [
  // "48-Pin", "3 leads", "20-lead", "1723 balls"
  /(?<![\d.x×*])(\d{1,4})\s*-?\s*(?:pins?|leads?|balls?|terminals?|ld)\b/i,
  // "QFN-16", "SOIC-8", "FCBGA1723", but not "DFN2*2" (a size)
  new RegExp(String.raw`\b(?:${CODE_LIST})-?(\d{1,4})(?![\d.]*\s*[x×*])`, "i"),
  // "(SOIC, 8)"
  new RegExp(String.raw`\b(?:${CODE_LIST}),\s*(\d{1,4})\b`, "i"),
  // "50-FC2QFN"
  /(?<![\d.])(\d{1,4})-[A-Z0-9]*(?:QFN|QFP|BGA|SOIC|SOP|SON|DFN)/i,
  // "DFN2*2-8", "QFN3x3-16": a body size, then the count
  new RegExp(String.raw`\b(?:${CODE_LIST})\d+(?:\.\d+)?\s*[x×*]\s*\d+(?:\.\d+)?-(\d{1,4})\b`, "i"),
  // "8L SOIC", "SSOP16L"
  /(?:^|[^\d.])(\d{1,3})L\b/,
  // "SO-8EP", "SMD-16"
  /\b(?:SO|SMD)-(\d{1,3})(?!\d)/i,
];

/** The package's pin or ball count, or null when the description doesn't state one. */
export function readPackagePinCount(packageText: string): number | null {
  for (const pattern of PIN_COUNT_PATTERNS) {
    const match = packageText.match(pattern);

    if (match) {
      const count = Number.parseInt(match[1], 10);

      if (count > 0) {
        return count;
      }
    }
  }

  return null;
}

const EXPOSED_PAD_TEXT =
  /exposed\s+(?:thermal\s+)?(?:pad|paddle)|thermal\s+pad|power\s?pad|\bE-?PAD\b|\bEP\b|\dEP\b/i;

export function mentionsExposedPad(packageText: string) {
  return EXPOSED_PAD_TEXT.test(packageText);
}

const EXPOSED_PAD_NAME =
  /^(?:ep|e-?pad|pad|paddle|dap|exp(?:osed)?[_\s-]+(?:thermal[_\s-]+)?(?:pad|paddle)|thermal[_\s-]+pad|power\s?pad)\b/i;
const EXPOSED_PAD_NUMBER =
  /^(?:ep|e-?pad|pad|paddle|dap|exp(?:osed)?[_\s-]?(?:pad|paddle)|thermal[_\s-]?pad)$/i;

/**
 * Whether a pin row is the exposed pad, by its name ("EP", "Thermal Pad") or
 * its number ("EP", "EXP_PAD", "Paddle"). A SOT-223 tab is a lead, not a pad.
 */
export function isExposedPadPin(pin: { pinName: string; pinNumber: string }) {
  return EXPOSED_PAD_NAME.test(pin.pinName.trim()) || EXPOSED_PAD_NUMBER.test(pin.pinNumber.trim());
}

/**
 * The separate pin numbers a row lists: "1, 2, 3" or "13–16" lists several,
 * "A1" or "7" lists one. Ranges are expanded only when both ends are plain
 * numbers.
 */
export function listPinNumbers(pinNumber: string): string[] {
  const parts = pinNumber
    .split(/\s*(?:,|;|&|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const numbers: string[] = [];

  for (const part of parts) {
    const range = part.match(/^(\d{1,4})\s*(?:-|–|—|to)\s*(\d{1,4})$/i);

    if (range) {
      const start = Number.parseInt(range[1], 10);
      const end = Number.parseInt(range[2], 10);

      if (end > start && end - start <= 512) {
        for (let pin = start; pin <= end; pin += 1) {
          numbers.push(String(pin));
        }

        continue;
      }
    }

    numbers.push(part);
  }

  return numbers.length > 0 ? numbers : [pinNumber.trim()];
}

const SEPARATE_DRAWING_NOTE =
  /\b(?:outline|package (?:drawing|outline|document)|mechanical drawing|land pattern)\b[^.]*\b(?:separate|not (?:included|attached|provided|in (?:this|the) (?:pdf|datasheet))|refer(?:s|red)? to|see)\b|\b(?:separate|external|referenced)\b[^.]*\b(?:outline|drawing)\b|\b(?:21-\d{6}|98A[A-Z]{2}\d{5}[A-Z]?)\b|\bno (?:package )?(?:mechanical )?(?:dimensions|drawing)\b/i;

/** Whether the AI's notes say the package dimensions are in a separate document, such as "outline 21-100765". */
export function mentionsSeparateDrawing(notes: readonly string[]) {
  return notes.some((note) => SEPARATE_DRAWING_NOTE.test(note));
}
