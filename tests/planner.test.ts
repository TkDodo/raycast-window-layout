import { describe, expect, it } from "vitest";
import { createLayoutFromSnapshot } from "../src/capture";
import { createRestorePlan } from "../src/planner";
import { SystemSnapshot } from "../src/types";

const snapshot: SystemSnapshot = {
  displays: [
    {
      id: 1,
      uuid: "display-work",
      index: 1,
      frame: { x: 0, y: 0, w: 1728, h: 1117 },
      spaces: [1, 2],
      label: "Studio Display",
    },
    {
      id: 2,
      uuid: "display-laptop",
      index: 2,
      frame: { x: 1728, y: 0, w: 1512, h: 982 },
      spaces: [3],
      label: "MacBook Pro",
    },
  ],
  spaces: [
    { id: 1, index: 1, display: 1 },
    { id: 2, index: 2, display: 1 },
    { id: 3, index: 3, display: 2 },
  ],
  windows: [
    {
      id: 101,
      app: "Arc",
      title: "Dashboard",
      display: 1,
      space: 1,
      frame: { x: 0, y: 0, w: 1000, h: 900 },
    },
    {
      id: 102,
      app: "Slack",
      title: "general",
      display: 2,
      space: 1,
      frame: { x: 1800, y: 40, w: 600, h: 900 },
    },
  ],
};

describe("createLayoutFromSnapshot", () => {
  it("normalizes displays and windows into a saved layout", () => {
    const layout = createLayoutFromSnapshot("Work", snapshot, "weekday");

    expect(layout.name).toBe("Work");
    expect(layout.notes).toBe("weekday");
    expect(layout.displays).toHaveLength(2);
    expect(layout.windows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          app: "Arc",
          title: "Dashboard",
          targetDisplayId: "display-work",
          targetSpaceIndex: 1,
          targetSpacePosition: 1,
          matchMode: "app",
        }),
      ]),
    );
  });

  it("captures mission-control space indices even when window.space already contains the global index", () => {
    const mixedSnapshot: SystemSnapshot = {
      displays: [
        {
          id: 10,
          uuid: "built-in",
          index: 1,
          frame: { x: 0, y: 0, w: 1512, h: 982 },
          spaces: [1001],
          label: "MacBook Pro",
        },
        {
          id: 20,
          uuid: "vertical",
          index: 2,
          frame: { x: 4952, y: -1581, w: 1440, h: 2560 },
          spaces: [2001, 2002, 2003],
          label: "Vertical",
        },
        {
          id: 30,
          uuid: "wide",
          index: 3,
          frame: { x: 1512, y: -799, w: 3440, h: 1440 },
          spaces: [3001, 3002, 3003],
          label: "Wide",
        },
      ],
      spaces: [
        { id: 1001, index: 1, display: 10 },
        { id: 2001, index: 2, display: 20 },
        { id: 2002, index: 3, display: 20 },
        { id: 2003, index: 4, display: 20 },
        { id: 3001, index: 5, display: 30 },
        { id: 3002, index: 6, display: 30 },
        { id: 3003, index: 7, display: 30 },
      ],
      windows: [
        {
          id: 999,
          app: "Codex",
          title: "Codex",
          display: 20,
          space: 4,
          frame: { x: 4952, y: -1556, w: 1440, h: 2535 },
        },
        {
          id: 1000,
          app: "Discord",
          title: "Discord",
          display: 30,
          space: 6,
          frame: { x: 1512, y: -774, w: 1720, h: 1415 },
        },
      ],
    };

    const layout = createLayoutFromSnapshot("Home", mixedSnapshot);

    expect(layout.windows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          app: "Codex",
          targetSpaceIndex: 4,
          targetSpacePosition: 3,
        }),
        expect.objectContaining({
          app: "Discord",
          targetSpaceIndex: 6,
          targetSpacePosition: 2,
        }),
      ]),
    );
  });

  it("skips windows that are present in yabai but not visible", () => {
    const hiddenSnapshot: SystemSnapshot = {
      ...snapshot,
      windows: [
        ...snapshot.windows,
        {
          id: 103,
          app: "GitHub Desktop",
          title: "",
          display: 1,
          space: 1,
          frame: { x: 468, y: 201, w: 960, h: 660 },
          isVisible: false,
        },
      ],
    };

    const layout = createLayoutFromSnapshot("Home", hiddenSnapshot);

    expect(layout.windows.find((window) => window.app === "GitHub Desktop")).toBeUndefined();
  });

  it("skips Raycast itself when saving layouts", () => {
    const raycastSnapshot: SystemSnapshot = {
      ...snapshot,
      windows: [
        ...snapshot.windows,
        {
          id: 104,
          app: "Raycast",
          title: "",
          display: 1,
          space: 1,
          frame: { x: 200, y: 100, w: 750, h: 474 },
        },
      ],
    };

    const layout = createLayoutFromSnapshot("Home", raycastSnapshot);

    expect(layout.windows.find((window) => window.app === "Raycast")).toBeUndefined();
  });
});

describe("createRestorePlan", () => {
  it("creates space and window move plans for matching windows", () => {
    const layout = {
      ...createLayoutFromSnapshot("Work", snapshot),
      windows: [
        {
          id: "arc",
          app: "Arc",
          title: "Dashboard",
          matchMode: "app" as const,
          targetDisplayId: "display-work",
          targetSpaceIndex: 3,
          targetSpacePosition: 3,
          targetFrame: { x: 50, y: 50, w: 1100, h: 900 },
        },
        {
          id: "slack",
          app: "Slack",
          title: "random",
          matchMode: "app" as const,
          targetDisplayId: "display-laptop",
          targetSpaceIndex: 3,
          targetSpacePosition: 1,
          targetFrame: { x: 1800, y: 20, w: 700, h: 900 },
        },
      ],
    };

    const current: SystemSnapshot = {
      ...snapshot,
      windows: [
        snapshot.windows[0],
        {
          id: 201,
          app: "Slack",
          title: "engineering",
          display: 2,
          space: 1,
          frame: { x: 1800, y: 20, w: 700, h: 900 },
        },
      ],
    };

    const plan = createRestorePlan(layout, current);

    expect(plan.spacesToCreate).toEqual([
      {
        displayId: 1,
        requiredCount: 3,
        existingCount: 2,
      },
    ]);
    expect(plan.windowMoves).toEqual([
      expect.objectContaining({
        windowId: 101,
        matchedBy: "title",
        targetDisplayId: 1,
        targetSpaceIndex: 3,
        targetSpacePosition: 3,
      }),
      expect.objectContaining({
        windowId: 201,
        matchedBy: "app",
        targetDisplayId: 2,
        targetSpaceIndex: 3,
        targetSpacePosition: 1,
      }),
    ]);
    expect(plan.unmatchedSavedWindows).toHaveLength(0);
  });

  it("treats app name as the primary identity even when titles change", () => {
    const layout = createLayoutFromSnapshot("Work", snapshot);
    const current: SystemSnapshot = {
      ...snapshot,
      windows: [
        {
          ...snapshot.windows[0],
          title: "A Different Brave Tab",
        },
        {
          ...snapshot.windows[1],
          title: "A Different Slack Channel",
        },
      ],
    };

    const plan = createRestorePlan(layout, current);

    expect(plan.windowMoves).toEqual([
      expect.objectContaining({
        windowId: 101,
        matchedBy: "app",
      }),
      expect.objectContaining({
        windowId: 102,
        matchedBy: "app",
      }),
    ]);
    expect(plan.unmatchedSavedWindows).toHaveLength(0);
  });

  it("leaves missing apps unmatched", () => {
    const layout = createLayoutFromSnapshot("Work", snapshot);
    const current: SystemSnapshot = { ...snapshot, windows: [snapshot.windows[0]] };

    const plan = createRestorePlan(layout, current);

    expect(plan.windowMoves).toHaveLength(1);
    expect(plan.unmatchedSavedWindows).toEqual([
      expect.objectContaining({
        app: "Slack",
      }),
    ]);
  });
});
