import { describe, expect, it } from "vitest";
import { buildRestoreReport } from "../src/restore";

describe("buildRestoreReport", () => {
  it("orders sections as problems, moved, then already correct", () => {
    const report = buildRestoreReport(
      [
        {
          app: "Slack",
          title: "",
          reason: "Display 2 is missing 1 desktop.",
        },
      ],
      [
        {
          windowId: 1,
          app: "Brave Browser",
          title: "PR",
          matchedBy: "app",
          fromDisplayIndex: 1,
          fromSpaceIndex: 1,
          toDisplayIndex: 2,
          toSpaceIndex: 5,
          changedDesktop: true,
        },
        {
          windowId: 2,
          app: "Discord",
          title: "Chat",
          matchedBy: "app",
          fromDisplayIndex: 2,
          fromSpaceIndex: 6,
          toDisplayIndex: 2,
          toSpaceIndex: 6,
          changedDesktop: false,
        },
      ],
      ["SmartGit"],
    );

    expect(report.sections.map((section) => section.title)).toEqual([
      "Problems",
      "Moved",
      "Already Correct",
      "Missing",
    ]);

    expect(report.sections[0].items[0]).toEqual(
      expect.objectContaining({
        title: "Slack",
        tint: "red",
      }),
    );

    expect(report.sections[1].items[0]).toEqual(
      expect.objectContaining({
        title: "Brave Browser",
        subtitle: "display 1, desktop 1 -> display 2, desktop 5",
        tint: "green",
      }),
    );

    expect(report.sections[2].items[0]).toEqual(
      expect.objectContaining({
        title: "Discord",
        subtitle: "didn't move (display 2, desktop 6)",
        tint: "white",
      }),
    );
  });
});
