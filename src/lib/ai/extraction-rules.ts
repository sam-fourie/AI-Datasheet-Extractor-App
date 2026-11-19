import {
  PACKAGE_CATEGORY_FIELDS,
  type PackageCategory,
} from "@/lib/package-categories";

/**
 * The house rulebook for extractions: what each measurement field means for
 * each package family, how values are written and how pins are named. Prompt
 * v2 sends it to the model, and the extraction post-processing and the review
 * checks apply the parts code can apply. Client-safe: no SDK imports.
 *
 * Sources: the lead reviewer's corrections and notes in the October 2026
 * reviews. Each definition records its basis so the definitions sheet can show
 * what still needs sign-off.
 */

/** v1 is the original seven-rule prompt; v2 adds this rulebook and the post-processing. */
export const EXTRACTION_PROMPT_VERSIONS = ["v1", "v2"] as const;

export type ExtractionPromptVersion = (typeof EXTRACTION_PROMPT_VERSIONS)[number];

/**
 * v2 since November 2026: on the 35 reviewed datasheets it got 26 measurements
 * wrong against v1's 51 (npm run score). The lead reviewer's sign-off may
 * still change some definitions.
 */
export const DEFAULT_EXTRACTION_PROMPT_VERSION: ExtractionPromptVersion = "v2";

export function isExtractionPromptVersion(value: unknown): value is ExtractionPromptVersion {
  return (
    typeof value === "string" &&
    (EXTRACTION_PROMPT_VERSIONS as readonly string[]).includes(value)
  );
}

export type PackageFamily =
  | "axial"
  | "bga"
  | "chip"
  | "dip"
  | "electrolytic"
  | "header"
  | "leadedQuad"
  | "leadedTwoSided"
  | "moulded"
  | "noLeadQuad"
  | "noLeadTwoSided"
  | "radial"
  | "smallOutlineDiode"
  | "socket"
  | "transistorVertical";

export const PACKAGE_FAMILIES: Record<PackageCategory, PackageFamily> = {
  "Antennas Chip": "chip",
  BGA: "bga",
  "Capacitor Al Electrolytic": "electrolytic",
  "Capacitor Chip Non-polarised": "chip",
  "Capacitor Chip Polarised": "chip",
  "Capacitor Moulded Non Polarised": "moulded",
  "Capacitor Moulded Polarised": "moulded",
  "Capacitor, Polarized Radial Diameter": "radial",
  "Capacitors, Polarized Axial Diameter Horizontal Mounting": "axial",
  "Ceramic Dual-In-Line Packages": "dip",
  "Diodes Chip": "chip",
  "Diodes Chip Non-polarised": "chip",
  "Diodes Moulded": "moulded",
  "Diodes Moulded Non Polarised": "moulded",
  "Diodes, Axial Diameter Horizontal Mounting": "axial",
  "Dual-In-Line Packages": "dip",
  "Dual-In-Line Sockets": "socket",
  "Ferrite Bead Chip": "chip",
  "Fuses Chip": "chip",
  "Fuses Moulded": "moulded",
  "Header, Receptacle - Right Angle PTH Box": "header",
  "Header, Receptacle - Straight PTH Box": "header",
  "Header, Shrouded": "header",
  "Header, Shrouded - Right Angle PTH Box": "header",
  "Header, Shrouded - Straight PTH Box": "header",
  "Header, Unshrouded - Right Angle PTH Pin": "header",
  "Header, Unshrouded - Single Row Staggered SMD Pin": "header",
  "Header, Unshrouded - Straight SMD Pin": "header",
  "Header, Vertical": "header",
  "Inductor Moulded": "moulded",
  "Inductors Chip": "chip",
  "Inductors Precision Moulded": "moulded",
  "Inductors, Axial Diameter Horizontal Mounting": "axial",
  "LED Moulded": "moulded",
  "LEDs Chip": "chip",
  "Plastic Leaded Chip Carrier": "leadedQuad",
  "Quad Flat No-Lead": "noLeadQuad",
  "Quad Flat Packages": "leadedQuad",
  "Resistor Chip": "chip",
  "Resistor Moulded": "moulded",
  "Resistors, Axial Diameter Horizontal Mounting": "axial",
  "SO Transistor Flat Lead": "leadedTwoSided",
  "SOT223 (3-Pin)": "leadedTwoSided",
  "SOT223 (4-Pin)": "leadedTwoSided",
  "SOT223 (5-Pin)": "leadedTwoSided",
  "SOT23 (3-Pin)": "leadedTwoSided",
  "SOT23 (5-Pin)": "leadedTwoSided",
  "SOT23 (6-Pin)": "leadedTwoSided",
  "SOT23 (8-Pin)": "leadedTwoSided",
  "Small Outline Diode": "smallOutlineDiode",
  "Small Outline Diode Flat Lead": "smallOutlineDiode",
  "Small Outline No-lead": "noLeadTwoSided",
  "Small Outline Packages": "leadedTwoSided",
  "Thermistors Chip": "chip",
  "Transistor Outline, Vertical": "transistorVertical",
  "Varistors Chip": "chip",
};

export const PACKAGE_FAMILY_LABELS: Record<PackageFamily, string> = {
  axial: "Axial leaded parts",
  bga: "Ball grid arrays",
  chip: "Two-terminal chip parts",
  dip: "Dual-in-line packages",
  electrolytic: "SMD aluminium electrolytic capacitors",
  header: "Headers and receptacles",
  leadedQuad: "Quad flat packages and PLCCs",
  leadedTwoSided: "Small-outline packages, SOT-23 and SOT-223",
  moulded: "Moulded two-terminal parts",
  noLeadQuad: "QFN",
  noLeadTwoSided: "SON and DFN",
  radial: "Radial capacitors",
  smallOutlineDiode: "SOD diodes",
  socket: "DIL sockets",
  transistorVertical: "Vertical transistor outlines",
};

/**
 * reviewed: matches the lead reviewer's corrections or notes.
 * standard: the usual meaning on package drawings, with no reviewed examples yet.
 * draft: a best guess that needs the lead reviewer to confirm or replace it.
 */
export type FieldDefinitionBasis = "reviewed" | "standard" | "draft";

export type FieldDefinition = {
  basis: FieldDefinitionBasis;
  text: string;
};

type FieldEntry = {
  /** Meanings for one category, ahead of its family's. */
  categories?: Partial<Record<PackageCategory, FieldDefinition>>;
  default?: FieldDefinition;
  families?: Partial<Record<PackageFamily, FieldDefinition>>;
};

export type MeasurementFieldName =
  (typeof PACKAGE_CATEGORY_FIELDS)[PackageCategory][number];

const reviewed = (text: string): FieldDefinition => ({ basis: "reviewed", text });
const standard = (text: string): FieldDefinition => ({ basis: "standard", text });
const draft = (text: string): FieldDefinition => ({ basis: "draft", text });

const QUAD_BODY_LENGTH = reviewed(
  "Body size along the top and bottom edges as drawn in the datasheet's top view, without the leads (D, or D1 on quad flat packages). The Top/Bottom Pins run along this side.",
);
const QUAD_BODY_WIDTH = reviewed(
  "Body size along the left and right edges as drawn in the top view, without the leads (E, or E1 on quad flat packages). The Left/Right Pins run along this side.",
);
const NO_LEAD_PIN_LENGTH = reviewed(
  "Length of one terminal on the underside, from the package edge inwards (L).",
);
const NO_LEAD_PIN_WIDTH = reviewed("Width of one terminal (b).");

/** Every measurement field must have an entry; an empty entry means no definition yet. */
export const FIELD_DEFINITIONS: Record<MeasurementFieldName, FieldEntry> = {
  "Body Height": {
    default: draft("Height of the plastic body above the board, without the pins."),
  },
  "Body Length": {
    default: standard("Length of the body without its leads or pins."),
    families: {
      axial: reviewed("Length of the body without the leads (L)."),
      bga: standard("Body size along one edge (D)."),
      chip: reviewed(
        "Length from the outer end of one terminal to the outer end of the other (L), along the line between the terminals.",
      ),
      dip: standard("Length of the body along the rows of pins (D)."),
      leadedQuad: QUAD_BODY_LENGTH,
      leadedTwoSided: reviewed(
        "Length of the body along the rows of pins, without the leads (usually D).",
      ),
      noLeadQuad: QUAD_BODY_LENGTH,
      noLeadTwoSided: standard("Length of the body along the rows of terminals (D)."),
      smallOutlineDiode: reviewed("Length of the body between the two leads, without the leads."),
    },
  },
  "Body Offset X": {},
  "Body Offset Y": {},
  "Body Width": {
    default: standard("Width of the body without its leads or pins."),
    families: {
      axial: reviewed("Body diameter (D)."),
      bga: standard("Body size along the other edge (E)."),
      chip: reviewed("Width of the body (W), at right angles to the line between the terminals."),
      dip: standard("Width of the body across the rows of pins, without the leads (E1)."),
      electrolytic: draft("Body diameter (D)."),
      leadedQuad: QUAD_BODY_WIDTH,
      leadedTwoSided: reviewed(
        "Width of the body across the rows of pins, without the leads (usually E1; some vendors call it E).",
      ),
      moulded: reviewed("Width of the body at right angles to the line between the terminals."),
      noLeadQuad: QUAD_BODY_WIDTH,
      noLeadTwoSided: standard("Width of the body across the rows of terminals (E)."),
      radial: reviewed("Maximum body diameter including its tolerance (D max), as one value."),
      smallOutlineDiode: reviewed("Width of the body at right angles to the line between the leads."),
    },
  },
  Height: {
    default: reviewed(
      "Maximum overall height above the board, including the stand-off (A max). Write one value: the maximum. Not the body thickness alone (A2).",
    ),
    families: {
      radial: reviewed(
        "Maximum height above the board including its tolerance (L max). Write one value: the maximum.",
      ),
    },
  },
  "Lead Length": {
    default: draft("Length of the pin tail below the body, on the board side."),
  },
  "Left/Right Pins": {
    default: reviewed(
      "Number of pins on each of the left and right sides as drawn in the top view, as a whole number.",
    ),
  },
  "Mounting Pin Diameter": {
    default: draft("Diameter of a mounting peg."),
  },
  "Mounting Pin Style": {},
  "Mounting Pin1 X": {},
  "Mounting Pin1 Y": {},
  "Mounting Pin2 X": {},
  "Mounting Pin2 Y": {},
  "Number of Columns": {
    default: standard("Number of ball columns in the full grid (usually numbered), as a whole number."),
  },
  "Number of Rows": {
    default: standard("Number of rows of pins, as a whole number."),
    families: {
      bga: standard("Number of ball rows in the full grid (usually lettered), as a whole number."),
    },
  },
  "PLCC Pin Span 1": {
    default: draft(
      "Distance across the J-leads where they meet the board, along Body Length.",
    ),
  },
  "PLCC Pin Span 2": {
    default: draft("Distance across the J-leads where they meet the board, along Body Width."),
  },
  "PTH Pin Size": {
    default: reviewed("Diameter of the lead that goes through the board (d or b)."),
  },
  "Pin Diameter": {
    default: standard("Diameter of one solder ball (b)."),
  },
  "Pin Height": {},
  "Pin Length": {
    default: reviewed(
      "Length of the flat foot that sits on the board (L), not the whole lead (L1) and never the corner chamfer (h).",
    ),
    families: {
      electrolytic: draft("Length of one terminal."),
      header: draft("Length of one pin."),
      noLeadQuad: NO_LEAD_PIN_LENGTH,
      noLeadTwoSided: NO_LEAD_PIN_LENGTH,
      smallOutlineDiode: reviewed(
        "Length of the flat part of the lead that sits on the board, along the line between the leads (L).",
      ),
      socket: draft("Length of one pin below the body."),
    },
  },
  "Pin Length 1": {
    default: reviewed(
      "Size of terminal 1 across the body, at right angles to the line between the terminals. On SMA, SMB and SMC diodes this is the lead width (b).",
    ),
  },
  "Pin Length 2": {
    default: reviewed(
      "Size of terminal 2 across the body, at right angles to the line between the terminals. Normally the same as Pin Length 1.",
    ),
  },
  "Pin Ordering": {},
  "Pin Pitch": {
    default: reviewed(
      "Centre-to-centre distance between two neighbouring pins in a row. When the drawing also gives the distance across several pins, use the neighbouring one: on a SOT-23 that is 0.95 mm, not the 1.90 mm across the outer pins.",
    ),
    families: {
      bga: standard("Centre-to-centre distance between neighbouring balls (e)."),
      radial: reviewed("Centre-to-centre distance between the two leads (F or P)."),
    },
  },
  "Pin Spacing": {},
  "Pin Span": {
    default: standard("Tip-to-tip distance across the leads."),
    families: {
      electrolytic: draft(
        "Distance from the outer end of one terminal to the outer end of the other.",
      ),
      leadedTwoSided: reviewed(
        "Tip-to-tip distance across the leads of the two rows (usually E; some vendors call it E1 or H).",
      ),
      moulded: reviewed(
        "Overall length from the outer end of one terminal to the outer end of the other.",
      ),
      smallOutlineDiode: reviewed(
        "Overall length from the tip of one lead to the tip of the other.",
      ),
    },
  },
  "Pin Span 1": {
    default: standard(
      "Tip-to-tip distance across the leads along Body Length (D on quad flat packages).",
    ),
  },
  "Pin Span 2": {
    default: standard(
      "Tip-to-tip distance across the leads along Body Width (E on quad flat packages).",
    ),
  },
  "Pin Width": {
    default: reviewed(
      "Width of one lead where it meets the board (b), never the lead thickness (c).",
    ),
    families: {
      electrolytic: draft("Width of one terminal."),
      header: standard("Width of one pin."),
      noLeadQuad: NO_LEAD_PIN_WIDTH,
      noLeadTwoSided: NO_LEAD_PIN_WIDTH,
      smallOutlineDiode: reviewed("Width of one lead across its foot (b)."),
      socket: standard("Width of one pin."),
    },
  },
  "Pin Width 1": {
    default: reviewed(
      "Width of the ordinary leads where they meet the board (b), never the lead thickness (c).",
    ),
    families: {
      chip: reviewed(
        "Length of terminal 1's metal end, measured along the body from its end (often called a, BW, t or T). When the top and bottom terminations differ, use the bottom one.",
      ),
      moulded: reviewed(
        "Size of terminal 1 along the line between the terminals. On SMA, SMB and SMC diodes this is the lead length (L).",
      ),
    },
  },
  "Pin Width 2": {
    default: reviewed(
      "Width of the leads on the other side, where they meet the board. The same as Pin Width 1 when every lead is the same width.",
    ),
    categories: {
      "SOT223 (3-Pin)": reviewed("Width of the wide tab on the other side (often b2 or b1). Not found if the part has no tab."),
      "SOT223 (4-Pin)": reviewed("Width of the wide tab on the other side (often b2 or b1). Not found if the part has no tab."),
      "SOT223 (5-Pin)": reviewed("Width of the wide tab on the other side (often b2 or b1). Not found if the part has no tab."),
    },
    families: {
      chip: reviewed(
        "Length of terminal 2's metal end, measured the same way as Pin Width 1. Normally the same as Pin Width 1.",
      ),
      moulded: reviewed(
        "Size of terminal 2 along the line between the terminals. Normally the same as Pin Width 1.",
      ),
    },
  },
  "Row Pitch": {
    default: standard("Centre-to-centre distance between neighbouring rows of pins."),
    families: {
      bga: standard("Centre-to-centre distance between neighbouring rows of balls."),
      dip: standard("Centre-to-centre distance between the two rows of pins (often eA or E)."),
    },
  },
  "Stand Off": {
    default: standard(
      "Gap between the board and the underside of the body (A1), usually a small range such as 0.00–0.05 mm.",
    ),
  },
  "Tab Protrusion": {},
  "Tab to Pin Centres": {},
  "Thermal Pad Length": {
    default: reviewed(
      "Length of the exposed pad on the underside along Body Length (D2). Not found when there is no exposed pad.",
    ),
  },
  "Thermal Pad Width": {
    default: reviewed(
      "Width of the exposed pad on the underside along Body Width (E2). Not found when there is no exposed pad.",
    ),
  },
  "Top/Bottom Pins": {
    default: reviewed(
      "Number of pins on each of the top and bottom sides as drawn in the top view, as a whole number.",
    ),
  },
};

/** The definition of a field for a category, or null when there isn't one yet. */
export function getFieldDefinition(
  field: string,
  category: PackageCategory,
): FieldDefinition | null {
  const entry = FIELD_DEFINITIONS[field as MeasurementFieldName];

  if (!entry) {
    return null;
  }

  return (
    entry.categories?.[category] ??
    entry.families?.[PACKAGE_FAMILIES[category]] ??
    entry.default ??
    null
  );
}

export const VALUE_RULES: readonly string[] = [
  "Go by what a dimension measures, not by its letter. Vendors use different letters for the same dimension, and many drawings use no letters at all, so the letters above are only the usual ones. Read an unlettered dimension from where its dimension line sits.",
  "Give every value in millimetres, without inch equivalents. Convert a value the datasheet only gives in inches (1 in = 25.4 mm).",
  "Write a dimension with a minimum and a maximum as a range, for example 0.30–0.50 mm. Write a nominal with its own tolerance as the range it allows, so 0.40 ± 0.10 mm becomes 0.30–0.50 mm.",
  "A drawing's general tolerance note (such as \"tolerances ±0.005 in unless stated\") does not turn every value into a range: write those values as the nominal, for example 4.000 mm.",
  "When the datasheet gives only a maximum or only a minimum, keep the word: 0.05 mm max, 0.25 mm min. Keep \"typ\" on a value given only as typical.",
  "Write a dimension the datasheet only gives as one basic or nominal value as that value, for example 0.50 mm.",
  "Height is the maximum. When the datasheet gives only a typical or nominal height, write that value with \"typ\" and set needs_review rather than not_found.",
  "When no drawing gives the body size but the package name does (such as 6 mm × 6 mm), use it for Body Length and Body Width, and set needs_review.",
  "Otherwise only take a value from the dimension the field asks for. If that dimension isn't shown, use not_found rather than a nearby dimension.",
  "When the datasheet covers several sizes in one table, decode the part number to its size, case or value code, use only that row, and name the row in the review notes.",
  "If the package drawing is in a separate document that isn't attached, set the missing fields to not_found and name that document in the review notes.",
];

export const PIN_RULES: readonly string[] = [
  "Return one row per physical pin, in pin-number order. Never combine pins such as \"1, 2, 3\" or \"13–16\" in one row.",
  "List every pin of the package: the number of rows equals the package's pin count, plus one row for an exposed pad.",
  "An exposed or thermal pad on the underside is a pin. Give it the next number after the last pin and name it EP.",
  "Write active-low pins, drawn with a bar over the name or marked with a trailing #, as *NAME, for example *CS or *RESET. Mark each active-low part of a combined name: *RESET/*FAIL-SAFE. Only a bar or a # counts: a name printed with an N or _N ending, such as CSN or FAULTN, stays as printed.",
  "Use the pin names from the pin description table, as printed.",
  "Name a cathode K, never C, and an anode A.",
  "Pins on the same connection keep the same name, such as GND on several pins. Separate channels that share a name get _1, _2 and so on, numbered so the pins of one channel share the number, for example A_1, K_1, C_1 and E_1 for the first channel of an optocoupler.",
];

export type DefaultPin = { pinName: string; pinNumber: string };

const NON_POLARISED_PINS: readonly DefaultPin[] = [
  { pinName: "1", pinNumber: "1" },
  { pinName: "2", pinNumber: "2" },
];
const POLARISED_CAPACITOR_PINS: readonly DefaultPin[] = [
  { pinName: "+", pinNumber: "1" },
  { pinName: "-", pinNumber: "2" },
];
const DIODE_PINS: readonly DefaultPin[] = [
  { pinName: "K", pinNumber: "1" },
  { pinName: "A", pinNumber: "2" },
];

export type TwoTerminalKind = "diode" | "nonPolarised" | "polarisedCapacitor";

const TWO_TERMINAL_KINDS: Partial<Record<PackageCategory, TwoTerminalKind>> = {
  "Capacitor Al Electrolytic": "polarisedCapacitor",
  "Capacitor Chip Non-polarised": "nonPolarised",
  "Capacitor Chip Polarised": "polarisedCapacitor",
  "Capacitor Moulded Non Polarised": "nonPolarised",
  "Capacitor Moulded Polarised": "polarisedCapacitor",
  "Capacitor, Polarized Radial Diameter": "polarisedCapacitor",
  "Capacitors, Polarized Axial Diameter Horizontal Mounting": "polarisedCapacitor",
  "Diodes Chip": "diode",
  "Diodes Chip Non-polarised": "nonPolarised",
  "Diodes Moulded": "diode",
  "Diodes Moulded Non Polarised": "nonPolarised",
  "Diodes, Axial Diameter Horizontal Mounting": "diode",
  "Ferrite Bead Chip": "nonPolarised",
  "Fuses Chip": "nonPolarised",
  "Fuses Moulded": "nonPolarised",
  "Inductor Moulded": "nonPolarised",
  "Inductors Chip": "nonPolarised",
  "Inductors Precision Moulded": "nonPolarised",
  "Inductors, Axial Diameter Horizontal Mounting": "nonPolarised",
  "LED Moulded": "diode",
  "LEDs Chip": "diode",
  "Resistor Chip": "nonPolarised",
  "Resistor Moulded": "nonPolarised",
  "Resistors, Axial Diameter Horizontal Mounting": "nonPolarised",
  "Small Outline Diode": "diode",
  "Small Outline Diode Flat Lead": "diode",
  "Thermistors Chip": "nonPolarised",
  "Varistors Chip": "nonPolarised",
};

export function getTwoTerminalKind(category: PackageCategory): TwoTerminalKind | null {
  return TWO_TERMINAL_KINDS[category] ?? null;
}

/** The house pins for a two-terminal category, or null for every other category. */
export function getTwoTerminalPins(category: PackageCategory): readonly DefaultPin[] | null {
  switch (getTwoTerminalKind(category)) {
    case "diode":
      return DIODE_PINS;
    case "nonPolarised":
      return NON_POLARISED_PINS;
    case "polarisedCapacitor":
      return POLARISED_CAPACITOR_PINS;
    default:
      return null;
  }
}

function describeDefaultPins(pins: readonly DefaultPin[]) {
  return pins.map((pin) => `pin ${pin.pinNumber} named ${pin.pinName}`).join(" and ");
}

/** Builds the v2 prompt text for one extraction. */
export function buildRulebookPrompt(input: {
  packageCategory: PackageCategory;
  partNumber: string;
  requestedFields: readonly string[];
}) {
  const { packageCategory, partNumber, requestedFields } = input;
  const fieldLines = requestedFields.map((field) => {
    const definition = getFieldDefinition(field, packageCategory);

    return definition ? `- ${field}: ${definition.text}` : `- ${field}`;
  });
  const twoTerminalPins = getTwoTerminalPins(packageCategory);
  const pinLines = [...PIN_RULES];

  if (twoTerminalPins) {
    pinLines.push(
      `This is a two-terminal part. Return exactly two pins even when the datasheet doesn't number them: ${describeDefaultPins(twoTerminalPins)}.`,
    );
  }

  return [
    "Extract package measurements and pin mappings from the attached datasheet PDF.",
    `Part number: ${partNumber}`,
    `Package category: ${packageCategory}`,
    "",
    "Measurements. Return every field below exactly once. Each field means:",
    ...fieldLines,
    "",
    "How to write measurement values:",
    ...VALUE_RULES.map((rule) => `- ${rule}`),
    "",
    "Pins:",
    ...pinLines.map((rule) => `- ${rule}`),
    "",
    "Package and review:",
    "- Choose the package variant that matches the part number and category. Set needsReview when you are unsure.",
    "- If the datasheet shows the part in a different package family from the category above, say so in the review notes.",
    "- If a value is missing or unsupported, set status to not_found and value to null. If the evidence is weak or values conflict, set status to needs_review.",
    "- Evidence pages must be 1-based physical page indexes of the PDF file, not printed page labels.",
  ].join("\n");
}

export const RULEBOOK_DEVELOPER_MESSAGE =
  "You extract datasheet package measurements and pin maps into a strict schema. Follow the field meanings and house conventions in the request exactly. Never invent a measurement: use not_found or needs_review instead of guessing. Pin names follow the house conventions, including for two-terminal parts whose datasheet doesn't number the pins.";
