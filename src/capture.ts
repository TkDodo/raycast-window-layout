import { SavedLayout, SystemSnapshot } from "./types";

function getDisplaySpacePosition(snapshot: SystemSnapshot, displayId: number, spaceId: number): number {
  const spaces = snapshot.spaces
    .filter((space) => space.display === displayId)
    .sort((left, right) => left.index - right.index);

  const position = spaces.findIndex((space) => space.id === spaceId);
  return position >= 0 ? position + 1 : 1;
}

function getMissionControlSpaceIndex(snapshot: SystemSnapshot, spaceId: number): number {
  return snapshot.spaces.find((space) => space.id === spaceId)?.index ?? 1;
}

export function createLayoutFromSnapshot(name: string, snapshot: SystemSnapshot, notes?: string): SavedLayout {
  const timestamp = new Date().toISOString();
  const displaysById = new Map(snapshot.displays.map((display) => [display.id, display]));

  return {
    name,
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
    displays: snapshot.displays.map((display) => ({
      uuid: display.uuid ?? null,
      arrangementIndex: display.index,
      frame: display.frame,
      label: display.label ?? `Display ${display.index}`,
    })),
    windows: snapshot.windows
      .filter((window) => !window.isHidden && !window.isMinimized)
      .map((window, index) => ({
        id: `${window.app}:${window.display}:${window.space}:${index}`,
        app: window.app,
        title: window.title,
        matchMode: "app",
        targetDisplayId: (() => {
          const display = displaysById.get(window.display);
          if (!display) {
            return `${window.display}:${window.frame.w}x${window.frame.h}:Display ${window.display}`;
          }

          return display.uuid ?? `${display.index}:${display.frame.w}x${display.frame.h}:${display.label ?? `Display ${display.index}`}`;
        })(),
        targetSpaceIndex: getMissionControlSpaceIndex(snapshot, window.space),
        targetSpacePosition: getDisplaySpacePosition(snapshot, window.display, window.space),
        targetFrame: window.frame,
      })),
  };
}
