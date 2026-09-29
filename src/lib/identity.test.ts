import { describe, expect, it } from "vitest";

import { ACTOR_NAME_MAX_LENGTH, getInitials, normalizeActorName } from "./identity";

describe("normalizeActorName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeActorName("  Sam   Fourie  ")).toBe("Sam Fourie");
    expect(normalizeActorName("Sam\tFourie\n")).toBe("Sam Fourie");
  });

  it("returns null for blanks and non-strings", () => {
    expect(normalizeActorName("")).toBeNull();
    expect(normalizeActorName("   ")).toBeNull();
    expect(normalizeActorName(null)).toBeNull();
    expect(normalizeActorName(42)).toBeNull();
  });

  it("drops control characters and caps the length", () => {
    expect(normalizeActorName("Sam\u0000Fourie")).toBe("Sam Fourie");
    expect(normalizeActorName("a".repeat(ACTOR_NAME_MAX_LENGTH + 20))).toHaveLength(ACTOR_NAME_MAX_LENGTH);
  });

  it("keeps names written in any script", () => {
    expect(normalizeActorName("Zoë Ångström")).toBe("Zoë Ångström");
    expect(normalizeActorName("李小龙")).toBe("李小龙");
  });
});

describe("getInitials", () => {
  it("uses the first and last words", () => {
    expect(getInitials("Sam Fourie")).toBe("SF");
    expect(getInitials("Mary Jane van Wyk")).toBe("MW");
    expect(getInitials("cher")).toBe("C");
    expect(getInitials("Ángel Ómar")).toBe("ÁÓ");
  });
});
