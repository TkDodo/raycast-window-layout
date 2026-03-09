import { SavedLayout, SystemSnapshot } from "./types";

const EXCLUDED_APPS = new Set(["Raycast"]);

function resolveWindowSpace(snapshot: SystemSnapshot, displayId: number, windowSpaceRef: number) {
  return (
    snapshot.spaces.find((space) => space.display === displayId && space.index === windowSpaceRef) ??
    snapshot.spaces.find((space) => space.display === displayId && space.id === windowSpaceRef) ??
    snapshot.spaces.find((space) => space.id === windowSpaceRef) ??
    snapshot.spaces.find((space) => space.index === windowSpaceRef)
  );
}

function getDisplaySpacePosition(snapshot: SystemSnapshot, displayId: number, windowSpaceRef: number): number {
  const spaces = snapshot.spaces
    .filter((space) => space.display === displayId)
    .sort((left, right) => left.index - right.index);

  const resolvedSpace = resolveWindowSpace(snapshot, displayId, windowSpaceRef);
  if (!resolvedSpace) {
    return 1;
  }

  const position = spaces.findIndex((space) => space.index === resolvedSpace.index);
  return position >= 0 ? position + 1 : 1;
}

function getMissionControlSpaceIndex(snapshot: SystemSnapshot, displayId: number, windowSpaceRef: number): number {
  return resolveWindowSpace(snapshot, displayId, windowSpaceRef)?.index ?? windowSpaceRef;
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
      .filter(
        (window) =>
          !window.isHidden &&
          !window.isMinimized &&
          window.isVisible !== false &&
          !EXCLUDED_APPS.has(window.app),
      )
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
        targetSpaceIndex: getMissionControlSpaceIndex(snapshot, window.display, window.space),
        targetSpacePosition: getDisplaySpacePosition(snapshot, window.display, window.space),
        targetFrame: window.frame,
      })),
  };
}
