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
          matchMode: "app-title",
          targetDisplayId: "display-work",
          targetSpaceIndex: 2,
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
          matchMode: "app-title",
          targetDisplayId: "display-work",
          targetSpaceIndex: 1,
          targetFrame: { x: 10, y: 20, w: 1200, h: 900 },
        },
      ],
    };

    getSnapshot.mockResolvedValue(snapshot);

    const { restoreLayout } = await import("../src/restore");
    await restoreLayout(layout);

    expect(moveWindowToDisplay).toHaveBeenCalledWith(2548, 1);
  });
});
