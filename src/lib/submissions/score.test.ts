import { describe, expect, it } from "vitest";

import { SCORE_BANDS, scoreTone } from "@/lib/submissions/score";

describe("scoreTone", () => {
  it("maps the band boundaries", () => {
    expect(scoreTone(100)).toBe("success");
    expect(scoreTone(95)).toBe("success");
    expect(scoreTone(94)).toBe("warning");
    expect(scoreTone(94.9)).toBe("warning");
    expect(scoreTone(80)).toBe("warning");
    expect(scoreTone(79)).toBe("danger");
    expect(scoreTone(0)).toBe("danger");
  });

  it("is neutral without a score", () => {
    expect(scoreTone(null)).toBe("neutral");
    expect(scoreTone(undefined)).toBe("neutral");
    expect(scoreTone(Number.NaN)).toBe("neutral");
  });

  it("orders the bands best first", () => {
    expect(SCORE_BANDS.map((band) => band.tone)).toEqual(["success", "warning", "danger"]);
    expect(SCORE_BANDS.map((band) => band.min)).toEqual([95, 80, 0]);
  });
});
