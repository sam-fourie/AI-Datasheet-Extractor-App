import { describe, expect, it } from "vitest";

import { formatModelShortLabel, formatRunLabel, formatUsd } from "@/lib/ai/provider-meta";

describe("formatModelShortLabel", () => {
  it("uses the code name when there is one", () => {
    expect(formatModelShortLabel("gpt-5.6-terra")).toBe("Terra");
    expect(formatModelShortLabel("gpt-5.6-sol")).toBe("Sol");
    expect(formatModelShortLabel("gpt-6-astra")).toBe("Astra");
    expect(formatModelShortLabel("GPT-5.6 Terra")).toBe("Terra");
    expect(formatModelShortLabel("GPT-6 Astra")).toBe("Astra");
  });

  it("keeps plain version labels", () => {
    expect(formatModelShortLabel("gpt-5.4")).toBe("GPT-5.4");
    expect(formatModelShortLabel("GPT-5.4")).toBe("GPT-5.4");
  });

  it("returns unknown ids as-is", () => {
    expect(formatModelShortLabel("gpt-4o-2024-08-06")).toBe("gpt-4o-2024-08-06");
  });
});

describe("formatRunLabel", () => {
  it("joins model and effort", () => {
    expect(formatRunLabel({ model: "gpt-5.6-terra", reasoningEffort: "high" })).toBe(
      "Terra · High",
    );
    expect(formatRunLabel({ model: "gpt-5.4", reasoningEffort: "xhigh" })).toBe(
      "GPT-5.4 · Extra high",
    );
  });

  it("omits a missing effort", () => {
    expect(formatRunLabel({ model: "gpt-5.4" })).toBe("GPT-5.4");
    expect(formatRunLabel({ model: "gpt-5.4", reasoningEffort: "" })).toBe("GPT-5.4");
  });
});

describe("formatUsd", () => {
  it("uses two decimals at or above $0.10", () => {
    expect(formatUsd(0.1)).toBe("$0.10");
    expect(formatUsd(0.2213)).toBe("$0.22");
    expect(formatUsd(0.3811)).toBe("$0.38");
    expect(formatUsd(6.9812)).toBe("$6.98");
    expect(formatUsd(12)).toBe("$12.00");
  });

  it("uses three decimals from $0.01 up to $0.10", () => {
    expect(formatUsd(0.0332)).toBe("$0.033");
    expect(formatUsd(0.01)).toBe("$0.010");
    expect(formatUsd(0.0994)).toBe("$0.099");
  });

  it("uses four decimals below $0.01", () => {
    expect(formatUsd(0.0042)).toBe("$0.0042");
    expect(formatUsd(0.00049)).toBe("$0.0005");
  });

  it("picks the precision after rounding at the boundaries", () => {
    expect(formatUsd(0.0996)).toBe("$0.10");
    expect(formatUsd(0.00996)).toBe("$0.010");
  });

  it("formats zero plainly", () => {
    expect(formatUsd(0)).toBe("$0.00");
  });
});
