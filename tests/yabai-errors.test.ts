import { describe, expect, it } from "vitest";
import { formatYabaiRequirementHint } from "../src/yabai-errors";

describe("formatYabaiRequirementHint", () => {
  it("includes a concrete Homebrew path for Raycast PATH issues", () => {
    const hint = formatYabaiRequirementHint();

    expect(hint).toContain("/opt/homebrew/bin/yabai");
    expect(hint).toContain("YABAI_PATH");
  });
});
