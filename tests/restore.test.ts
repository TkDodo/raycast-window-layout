import { beforeEach, describe, expect, it, vi } from "vitest";
import { SavedLayout, SystemSnapshot } from "../src/types";

const createSpaceOnDisplay = vi.fn();
const getSnapshot = vi.fn<() => Promise<SystemSnapshot>>();
const moveWindowToDisplay = vi.fn();
const moveWindowToSpace = vi.fn();
const resizeWindow = vi.fn();

vi.mock("../src/yabai", () => ({
  createSpaceOnDisplay,
  getSnapshot,
  moveWindowToDisplay,
  moveWindowToSpace,
  resizeWindow,
}));

describe("restoreLayout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("moves windows using the target space mission-control index, not the internal yabai id", async () => {
    const snapshot: SystemSnapshot = {
      displays: [
        {
          id: 1,
          uuid: "display-work",
          index: 1,
          frame: { x: 0, y: 0, w: 1728, h: 1117 },
          spaces: [83, 85],
          label: "Studio Display",
        },
      ],
      spaces: [
        { id: 83, index: 1, display: 1 },
        { id: 85, index: 2, display: 1 },
      ],
      windows: [
        {
          id: 2548,
          app: "Arc",
          title: "Dashboard",
          display: 1,
          space: 83,
          frame: { x: 0, y: 0, w: 1000, h: 900 },
        },
      ],
    };

    const layout: SavedLayout = {
      name: "Work",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z",
      displays: [
        {
          uuid: "display-work",
          arrangementIndex: 1,
          frame: { x: 0, y: 0, w: 1728, h: 1117 },
          label: "Studio Display",
        },
      ],
      windows: [
        {
          id: "arc-dashboard",
          app: "Arc",
          title: "Dashboard",
          matchMode: "app",
          targetDisplayId: "display-work",
          targetSpaceIndex: 2,
          targetSpacePosition: 2,
          targetFrame: { x: 10, y: 20, w: 1200, h: 900 },
        },
      ],
    };

    getSnapshot.mockResolvedValue(snapshot);

    const { restoreLayout } = await import("../src/restore");
    await restoreLayout(layout);

    expect(moveWindowToSpace).toHaveBeenCalledWith(2548, 2);
  });

  it("moves windows using the target display mission-control index, not the internal yabai id", async () => {
    const snapshot: SystemSnapshot = {
      displays: [
        {
          id: 95,
          uuid: "display-work",
          index: 1,
          frame: { x: 0, y: 0, w: 1728, h: 1117 },
          spaces: [83],
          label: "Studio Display",
        },
      ],
      spaces: [{ id: 83, index: 1, display: 95 }],
      windows: [
        {
          id: 2548,
          app: "Arc",
          title: "Dashboard",
          display: 95,
          space: 83,
          frame: { x: 0, y: 0, w: 1000, h: 900 },
        },
      ],
    };

    const layout: SavedLayout = {
      name: "Work",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z",
      displays: [
        {
          uuid: "display-work",
          arrangementIndex: 1,
          frame: { x: 0, y: 0, w: 1728, h: 1117 },
          label: "Studio Display",
        },
      ],
      windows: [
        {
          id: "arc-dashboard",
          app: "Arc",
          title: "Dashboard",
          matchMode: "app",
          targetDisplayId: "display-work",
          targetSpaceIndex: 1,
          targetSpacePosition: 1,
          targetFrame: { x: 10, y: 20, w: 1200, h: 900 },
        },
      ],
    };

    getSnapshot.mockResolvedValue(snapshot);

    const { restoreLayout } = await import("../src/restore");
    await restoreLayout(layout);

    expect(moveWindowToDisplay).toHaveBeenCalledWith(2548, 1);
  });

  it("preserves global mission-control desktop indices across displays", async () => {
    const snapshot: SystemSnapshot = {
      displays: [
        {
          id: 10,
          uuid: "built-in",
          index: 1,
          frame: { x: 0, y: 0, w: 1512, h: 982 },
          spaces: [11],
          label: "MacBook Pro",
        },
        {
          id: 20,
          uuid: "external-left",
          index: 2,
          frame: { x: 1512, y: 0, w: 1728, h: 1117 },
          spaces: [12, 13, 14],
          label: "Studio Display",
        },
        {
          id: 30,
          uuid: "external-right",
          index: 3,
          frame: { x: 3240, y: 0, w: 1728, h: 1117 },
          spaces: [15, 16, 17],
          label: "LG UltraFine",
        },
      ],
      spaces: [
        { id: 11, index: 1, display: 10 },
        { id: 12, index: 2, display: 20 },
        { id: 13, index: 3, display: 20 },
        { id: 14, index: 4, display: 20 },
        { id: 15, index: 5, display: 30 },
        { id: 16, index: 6, display: 30 },
        { id: 17, index: 7, display: 30 },
      ],
      windows: [
        {
          id: 3001,
          app: "Arc",
          title: "Docs",
          display: 30,
          space: 17,
          frame: { x: 3300, y: 10, w: 1000, h: 900 },
        },
      ],
    };

    const layout: SavedLayout = {
      name: "Desk Setup",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z",
      displays: [
        {
          uuid: "external-right",
          arrangementIndex: 3,
          frame: { x: 3240, y: 0, w: 1728, h: 1117 },
          label: "LG UltraFine",
        },
      ],
      windows: [
        {
          id: "arc-docs",
          app: "Arc",
          title: "Docs",
          matchMode: "app",
          targetDisplayId: "external-right",
          targetSpaceIndex: 7,
          targetSpacePosition: 3,
          targetFrame: { x: 3300, y: 10, w: 1000, h: 900 },
        },
      ],
    };

    getSnapshot.mockResolvedValue(snapshot);

    const { restoreLayout } = await import("../src/restore");
    await restoreLayout(layout);

    expect(moveWindowToDisplay).toHaveBeenCalledWith(3001, 3);
    expect(moveWindowToSpace).toHaveBeenCalledWith(3001, 7);
  });

  it("moves windows to the current space at the saved per-display position when mission-control indices have shifted", async () => {
    const snapshot: SystemSnapshot = {
      displays: [
        {
          id: 20,
          uuid: "external-wide",
          index: 2,
          frame: { x: -3440, y: -511, w: 3440, h: 1440 },
          spaces: [201, 202, 203, 204],
          label: "Display 2",
        },
      ],
      spaces: [
        { id: 201, index: 8, display: 20 },
        { id: 202, index: 9, display: 20 },
        { id: 203, index: 10, display: 20 },
        { id: 204, index: 11, display: 20 },
      ],
      windows: [
        {
          id: 4001,
          app: "Slack",
          title: "DM",
          display: 20,
          space: 201,
          frame: { x: -1720, y: -486, w: 1720, h: 1415 },
        },
      ],
    };

    const layout: SavedLayout = {
      name: "Sentry",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      displays: [
        {
          uuid: "external-wide",
          arrangementIndex: 2,
          frame: { x: -3440, y: -511, w: 3440, h: 1440 },
          label: "Display 2",
        },
      ],
      windows: [
        {
          id: "slack-dm",
          app: "Slack",
          title: "DM",
          matchMode: "app",
          targetDisplayId: "external-wide",
          targetSpaceIndex: 4,
          targetSpacePosition: 2,
          targetFrame: { x: -1720, y: -486, w: 1720, h: 1415 },
        },
      ],
    };

    getSnapshot.mockResolvedValue(snapshot);

    const { restoreLayout } = await import("../src/restore");
    await restoreLayout(layout);

    expect(moveWindowToDisplay).toHaveBeenCalledWith(4001, 2);
    expect(moveWindowToSpace).toHaveBeenCalledWith(4001, 9);
  });

  it("resolves target spaces even when yabai reports space.display using the display index instead of the internal id", async () => {
    const snapshot: SystemSnapshot = {
      displays: [
        {
          id: 103,
          uuid: "external-wide",
          index: 2,
          frame: { x: -3440, y: -511, w: 3440, h: 1440 },
          spaces: [201, 202, 203, 204],
          label: "Display 2",
        },
      ],
      spaces: [
        { id: 201, index: 3, display: 2 },
        { id: 202, index: 4, display: 2 },
        { id: 203, index: 5, display: 2 },
        { id: 204, index: 6, display: 2 },
      ],
      windows: [
        {
          id: 4101,
          app: "Slack",
          title: "DM",
          display: 103,
          space: 201,
          frame: { x: -1720, y: -486, w: 1720, h: 1415 },
        },
        {
          id: 4102,
          app: "Discord",
          title: "TanStack",
          display: 103,
          space: 201,
          frame: { x: -3440, y: -486, w: 1720, h: 1415 },
        },
      ],
    };

    const layout: SavedLayout = {
      name: "Sentry",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      displays: [
        {
          uuid: "external-wide",
          arrangementIndex: 2,
          frame: { x: -3440, y: -511, w: 3440, h: 1440 },
          label: "Display 2",
        },
      ],
      windows: [
        {
          id: "slack-dm",
          app: "Slack",
          title: "DM",
          matchMode: "app",
          targetDisplayId: "external-wide",
          targetSpaceIndex: 4,
          targetSpacePosition: 2,
          targetFrame: { x: -1720, y: -486, w: 1720, h: 1415 },
        },
        {
          id: "discord",
          app: "Discord",
          title: "TanStack",
          matchMode: "app",
          targetDisplayId: "external-wide",
          targetSpaceIndex: 6,
          targetSpacePosition: 4,
          targetFrame: { x: -3440, y: -486, w: 1720, h: 1415 },
        },
      ],
    };

    getSnapshot.mockResolvedValue(snapshot);

    const { restoreLayout } = await import("../src/restore");
    await restoreLayout(layout);

    expect(moveWindowToSpace).toHaveBeenNthCalledWith(1, 4101, 4);
    expect(moveWindowToSpace).toHaveBeenNthCalledWith(2, 4102, 6);
  });

  it("re-resolves a window by app and title when the initial yabai window id goes stale", async () => {
    const planningSnapshot: SystemSnapshot = {
      displays: [
        {
          id: 95,
          uuid: "display-work",
          index: 1,
          frame: { x: 0, y: 0, w: 1728, h: 1117 },
          spaces: [83],
          label: "Studio Display",
        },
      ],
      spaces: [{ id: 83, index: 1, display: 95 }],
      windows: [
        {
          id: 95,
          app: "Discord",
          title: "TanStack - Discord",
          display: 95,
          space: 83,
          frame: { x: 0, y: 0, w: 1000, h: 900 },
        },
      ],
    };

    const executionSnapshot: SystemSnapshot = {
      ...planningSnapshot,
      windows: [
        {
          id: 4357,
          app: "Discord",
          title: "TanStack - Discord",
          display: 95,
          space: 83,
          frame: { x: 0, y: 0, w: 1000, h: 900 },
        },
      ],
    };

    const layout: SavedLayout = {
      name: "Work",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z",
      displays: [
        {
          uuid: "display-work",
          arrangementIndex: 1,
          frame: { x: 0, y: 0, w: 1728, h: 1117 },
          label: "Studio Display",
        },
      ],
      windows: [
        {
          id: "discord",
          app: "Discord",
          title: "TanStack - Discord",
          matchMode: "app",
          targetDisplayId: "display-work",
          targetSpaceIndex: 1,
          targetSpacePosition: 1,
          targetFrame: { x: 10, y: 20, w: 1200, h: 900 },
        },
      ],
    };

    getSnapshot.mockResolvedValueOnce(planningSnapshot).mockResolvedValueOnce(executionSnapshot);

    const { restoreLayout } = await import("../src/restore");
    await restoreLayout(layout);

    expect(moveWindowToDisplay).toHaveBeenCalledWith(4357, 1);
    expect(moveWindowToSpace).toHaveBeenCalledWith(4357, 1);
    expect(resizeWindow).toHaveBeenCalledWith(4357, { x: 10, y: 20, w: 1200, h: 900 });
  });

  it("retries with a freshly resolved window id when yabai says the target window disappeared mid-restore", async () => {
    const planningSnapshot: SystemSnapshot = {
      displays: [
        {
          id: 95,
          uuid: "display-work",
          index: 1,
          frame: { x: 0, y: 0, w: 1728, h: 1117 },
          spaces: [83],
          label: "Studio Display",
        },
      ],
      spaces: [{ id: 83, index: 1, display: 95 }],
      windows: [
        {
          id: 95,
          app: "Discord",
          title: "TanStack - Discord",
          display: 95,
          space: 83,
          frame: { x: 0, y: 0, w: 1000, h: 900 },
        },
      ],
    };

    const retrySnapshot: SystemSnapshot = {
      ...planningSnapshot,
      windows: [
        {
          id: 4357,
          app: "Discord",
          title: "TanStack - Discord",
          display: 95,
          space: 83,
          frame: { x: 0, y: 0, w: 1000, h: 900 },
        },
      ],
    };

    const layout: SavedLayout = {
      name: "Work",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z",
      displays: [
        {
          uuid: "display-work",
          arrangementIndex: 1,
          frame: { x: 0, y: 0, w: 1728, h: 1117 },
          label: "Studio Display",
        },
      ],
      windows: [
        {
          id: "discord",
          app: "Discord",
          title: "TanStack - Discord",
          matchMode: "app",
          targetDisplayId: "display-work",
          targetSpaceIndex: 1,
          targetSpacePosition: 1,
          targetFrame: { x: 10, y: 20, w: 1200, h: 900 },
        },
      ],
    };

    getSnapshot
      .mockResolvedValueOnce(planningSnapshot)
      .mockResolvedValueOnce(planningSnapshot)
      .mockResolvedValueOnce(retrySnapshot);
    moveWindowToDisplay
      .mockRejectedValueOnce(
        new Error(
          "yabai command failed: could not locate the window to act on! Command failed: /opt/homebrew/bin/yabai -m window 95 --display 1 could not locate the window to act on!",
        ),
      )
      .mockResolvedValueOnce(undefined);

    const { restoreLayout } = await import("../src/restore");
    await restoreLayout(layout);

    expect(moveWindowToDisplay).toHaveBeenNthCalledWith(1, 95, 1);
    expect(moveWindowToDisplay).toHaveBeenNthCalledWith(2, 4357, 1);
    expect(moveWindowToSpace).toHaveBeenCalledWith(4357, 1);
    expect(resizeWindow).toHaveBeenCalledWith(4357, { x: 10, y: 20, w: 1200, h: 900 });
  });

  it("continues restoring later windows when one window fails and reports that failure", async () => {
    const snapshot: SystemSnapshot = {
      displays: [
        {
          id: 95,
          uuid: "display-work",
          index: 1,
          frame: { x: 0, y: 0, w: 1728, h: 1117 },
          spaces: [83],
          label: "Studio Display",
        },
      ],
      spaces: [{ id: 83, index: 1, display: 95 }],
      windows: [
        {
          id: 95,
          app: "GitHub Desktop",
          title: "",
          display: 95,
          space: 83,
          frame: { x: 0, y: 0, w: 1000, h: 900 },
        },
        {
          id: 4357,
          app: "Discord",
          title: "TanStack - Discord",
          display: 95,
          space: 83,
          frame: { x: 0, y: 0, w: 1000, h: 900 },
        },
      ],
    };

    const layout: SavedLayout = {
      name: "Work",
      createdAt: "2026-03-09T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z",
      displays: [
        {
          uuid: "display-work",
          arrangementIndex: 1,
          frame: { x: 0, y: 0, w: 1728, h: 1117 },
          label: "Studio Display",
        },
      ],
      windows: [
        {
          id: "ghd",
          app: "GitHub Desktop",
          title: "",
          matchMode: "app",
          targetDisplayId: "display-work",
          targetSpaceIndex: 1,
          targetSpacePosition: 1,
          targetFrame: { x: 10, y: 20, w: 500, h: 500 },
        },
        {
          id: "discord",
          app: "Discord",
          title: "TanStack - Discord",
          matchMode: "app",
          targetDisplayId: "display-work",
          targetSpaceIndex: 1,
          targetSpacePosition: 1,
          targetFrame: { x: 20, y: 30, w: 600, h: 600 },
        },
      ],
    };

    getSnapshot.mockResolvedValue(snapshot);
    moveWindowToDisplay
      .mockRejectedValueOnce(new Error("yabai command failed: could not locate the window to act on!"))
      .mockResolvedValueOnce(undefined);

    const { restoreLayout } = await import("../src/restore");
    const result = await restoreLayout(layout);

    expect(moveWindowToDisplay).toHaveBeenNthCalledWith(1, 95, 1);
    expect(moveWindowToDisplay).toHaveBeenNthCalledWith(2, 4357, 1);
    expect(result.failures).toEqual([
      expect.objectContaining({
        app: "GitHub Desktop",
      }),
    ]);
    expect(moveWindowToSpace).toHaveBeenCalledWith(4357, 1);
  });
});
