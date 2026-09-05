import { describe, expect, it } from "vitest";
import { formatYabaiRequirementHint } from "../src/yabai-errors";
import { getYabaiCandidates, getYabaiEnvironment, normalizeYabaiWindow } from "../src/yabai";

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

describe("getYabaiEnvironment", () => {
  it("fills in USER and HOME for GUI-launched Raycast processes", () => {
    const env = getYabaiEnvironment({ PATH: "/usr/bin" });

    expect(env.USER).toBeTruthy();
    expect(env.LOGNAME).toBe(env.USER);
    expect(env.HOME).toBeTruthy();
    expect(env.PATH).toBe("/usr/bin");
  });
});

describe("normalizeYabaiWindow", () => {
  it("maps yabai's hyphenated window flags to the internal model", () => {
    const window = normalizeYabaiWindow({
      id: 167,
      app: "TkDodo",
      title: "",
      display: 3,
      space: 8,
      frame: { x: 3232, y: -774, w: 1720, h: 1415 },
      "can-move": false,
      "can-resize": false,
      "has-ax-reference": false,
      "is-visible": false,
      "is-minimized": false,
      "is-hidden": false,
    });

    expect(window).toEqual(
      expect.objectContaining({
        canMove: false,
        canResize: false,
        hasAxReference: false,
        isVisible: false,
        isMinimized: false,
        isHidden: false,
      }),
    );
  });
});
