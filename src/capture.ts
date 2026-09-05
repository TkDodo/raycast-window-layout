import { SavedLayout, SystemSnapshot, YabaiDisplay, YabaiSpace, YabaiWindow } from "./types";

const EXCLUDED_APPS = new Set(["Raycast"]);

function spacesForDisplay(snapshot: SystemSnapshot, display: YabaiDisplay): YabaiSpace[] {
  const spacesByDisplayIndex = snapshot.spaces.filter((space) => space.display === display.index);
  if (spacesByDisplayIndex.length > 0) {
    return spacesByDisplayIndex.sort((left, right) => left.index - right.index);
  }

  const spacesByDisplayId = snapshot.spaces.filter((space) => space.display === display.id);
  if (spacesByDisplayId.length > 0) {
    return spacesByDisplayId.sort((left, right) => left.index - right.index);
  }

  const displaySpaceRefs = new Set(display.spaces);
  return snapshot.spaces
    .filter((space) => displaySpaceRefs.has(space.id) || displaySpaceRefs.has(space.index))
    .sort((left, right) => left.index - right.index);
}

function displayOwnsWindowSpace(snapshot: SystemSnapshot, display: YabaiDisplay, windowSpaceRef: number): boolean {
  return spacesForDisplay(snapshot, display).some((space) => space.id === windowSpaceRef || space.index === windowSpaceRef);
}

function findWindowDisplay(snapshot: SystemSnapshot, window: YabaiWindow): YabaiDisplay | undefined {
  const byIndex = snapshot.displays.find((display) => display.index === window.display);
  if (byIndex && displayOwnsWindowSpace(snapshot, byIndex, window.space)) {
    return byIndex;
  }

  const byId = snapshot.displays.find((display) => display.id === window.display);
  if (byId && displayOwnsWindowSpace(snapshot, byId, window.space)) {
    return byId;
  }

  return byIndex ?? byId;
}

function resolveWindowSpace(snapshot: SystemSnapshot, display: YabaiDisplay, windowSpaceRef: number) {
  const displaySpaces = spacesForDisplay(snapshot, display);

  return (
    displaySpaces.find((space) => space.index === windowSpaceRef) ??
    displaySpaces.find((space) => space.id === windowSpaceRef)
  );
}

function getDisplaySpacePosition(snapshot: SystemSnapshot, display: YabaiDisplay, windowSpaceRef: number): number {
  const spaces = spacesForDisplay(snapshot, display);
  const resolvedSpace = resolveWindowSpace(snapshot, display, windowSpaceRef);
  if (!resolvedSpace) {
    return 1;
  }

  const position = spaces.findIndex((space) => space.index === resolvedSpace.index);
  return position >= 0 ? position + 1 : 1;
}

function getMissionControlSpaceIndex(snapshot: SystemSnapshot, display: YabaiDisplay, windowSpaceRef: number): number {
  return resolveWindowSpace(snapshot, display, windowSpaceRef)?.index ?? windowSpaceRef;
}

function displayFingerprint(display: YabaiDisplay): string {
  return display.uuid ?? `${display.index}:${display.frame.w}x${display.frame.h}:${display.label ?? `Display ${display.index}`}`;
}

export function createLayoutFromSnapshot(name: string, snapshot: SystemSnapshot, notes?: string): SavedLayout {
  const timestamp = new Date().toISOString();

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
          !EXCLUDED_APPS.has(window.app),
      )
      .map((window, index) => {
        const display = findWindowDisplay(snapshot, window);

        return {
          id: `${window.app}:${window.display}:${window.space}:${index}`,
          app: window.app,
          title: window.title,
          matchMode: "app",
          targetDisplayId: display
            ? displayFingerprint(display)
            : `${window.display}:${window.frame.w}x${window.frame.h}:Display ${window.display}`,
          targetSpaceIndex: display ? getMissionControlSpaceIndex(snapshot, display, window.space) : window.space,
          targetSpacePosition: display ? getDisplaySpacePosition(snapshot, display, window.space) : 1,
          targetFrame: window.frame,
        };
      }),
  };
}
