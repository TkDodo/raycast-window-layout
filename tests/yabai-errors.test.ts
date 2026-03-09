import { describe, expect, it } from "vitest";
import { formatYabaiRequirementHint } from "../src/yabai-errors";
import { getYabaiCandidates } from "../src/yabai";

describe("formatYabaiRequirementHint", () => {
  it("includes a concrete Homebrew path for Raycast PATH issues", () => {
    const hint = formatYabaiRequirementHint();

    expect(hint).toContain("/opt/homebrew/bin/yabai");
    expect(hint).toContain("YABAI_PATH");
  });
});

describe("getYabaiCandidates", () => {
  it("prefers explicit binary paths before falling back to PATH lookup", () => {
    expect(getYabaiCandidates()).toEqual([
      "/opt/homebrew/bin/yabai",
      "/usr/local/bin/yabai",
      "/opt/local/bin/yabai",
      "yabai",
    ]);
  });

  it("prefers YABAI_PATH over built-in defaults", () => {
    expect(getYabaiCandidates("/custom/yabai")[0]).toBe("/custom/yabai");
  });
});
