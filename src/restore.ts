import { createRestorePlan } from "./planner";
import {
  PlannedSpaceCreation,
  PlannedWindowMove,
  RestoreFailure,
  RestoreResult,
  RestoredWindowMove,
  SavedLayout,
  SystemSnapshot,
  YabaiDisplay,
  YabaiSpace,
  YabaiWindow,
} from "./types";
import { getSnapshot, moveWindowToDisplay, moveWindowToSpace, resizeWindow } from "./yabai";

function getSpaceForDisplayAndPosition(
  spaces: YabaiSpace[],
  displayId: number,
  displayIndex: number,
  position: number,
): YabaiSpace | undefined {
  return spaces
    .filter((space) => space.display === displayId || space.display === displayIndex)
    .sort((left, right) => left.index - right.index)
    .at(position - 1);
}

function findCurrentWindowForMove(
  move: PlannedWindowMove,
  snapshot: SystemSnapshot,
  usedWindowIds: Set<number>,
): YabaiWindow | undefined {
  const currentWindows = snapshot.windows.filter((window) => !window.isHidden && !window.isMinimized);
  const exactIdMatch = currentWindows.find((window) => window.id === move.windowId && !usedWindowIds.has(window.id));
  if (exactIdMatch) {
    return exactIdMatch;
  }

  const rankedMatches = currentWindows
    .filter((window) => window.app === move.app && !usedWindowIds.has(window.id))
    .sort((left, right) => {
      const leftScore = left.title === move.title ? 1 : 0;
      const rightScore = right.title === move.title ? 1 : 0;
      return rightScore - leftScore || left.id - right.id;
    });

  return rankedMatches[0];
}

function isMissingWindowError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("could not locate the window to act on");
}

function findDisplay(displays: YabaiDisplay[], displayRef: number): YabaiDisplay | undefined {
  return displays.find((display) => display.id === displayRef || display.index === displayRef);
}

function resolveWindowSpace(snapshot: SystemSnapshot, window: YabaiWindow): YabaiSpace | undefined {
  const currentDisplay = findDisplay(snapshot.displays, window.display);
  const displayId = currentDisplay?.id ?? window.display;
  const displayIndex = currentDisplay?.index ?? window.display;

  return (
    snapshot.spaces.find((space) => (space.display === displayId || space.display === displayIndex) && space.index === window.space) ??
    snapshot.spaces.find((space) => (space.display === displayId || space.display === displayIndex) && space.id === window.space) ??
    snapshot.spaces.find((space) => space.id === window.space) ??
    snapshot.spaces.find((space) => space.index === window.space)
  );
}

async function runWindowMoveSequence(
  windowId: number,
  move: PlannedWindowMove,
  snapshot: SystemSnapshot,
): Promise<RestoredWindowMove> {
  await moveWindowToDisplay(windowId, move.targetDisplayIndex);

  const currentWindow = snapshot.windows.find((window) => window.id === windowId);
  const currentDisplay = currentWindow ? findDisplay(snapshot.displays, currentWindow.display) : undefined;
  const currentSpace = currentWindow ? resolveWindowSpace(snapshot, currentWindow) : undefined;
  const targetSpace = getSpaceForDisplayAndPosition(snapshot.spaces, move.targetDisplayId, move.targetDisplayIndex, move.targetSpacePosition);
  if (targetSpace) {
    await moveWindowToSpace(windowId, targetSpace.index);
  }

  await resizeWindow(windowId, move.targetFrame);

  return {
    windowId,
    app: move.app,
    title: move.title,
    matchedBy: move.matchedBy,
    fromDisplayIndex: currentDisplay?.index ?? null,
    fromSpaceIndex: currentSpace?.index ?? null,
    toDisplayIndex: move.targetDisplayIndex,
    toSpaceIndex: targetSpace?.index ?? null,
    changedDesktop:
      currentDisplay?.index !== move.targetDisplayIndex ||
      currentSpace?.index !== (targetSpace?.index ?? null),
  };
}

function formatFailureLabel(failure: RestoreFailure): string {
  return failure.title ? `${failure.app} (${failure.title})` : failure.app;
}

function toRestoreFailure(move: PlannedWindowMove, error: unknown): RestoreFailure {
  return {
    app: move.app,
    title: move.title,
    reason: error instanceof Error ? error.message : "Unknown restore error",
  };
}

function toMissingDesktopFailure(move: PlannedWindowMove, blocker: PlannedSpaceCreation): RestoreFailure {
  const missingCount = blocker.requiredCount - blocker.existingCount;
  const desktopLabel = missingCount === 1 ? "desktop" : "desktops";

  return {
    app: move.app,
    title: move.title,
    reason: `Display ${move.targetDisplayIndex} is missing ${missingCount} ${desktopLabel}. Saved layout needs ${blocker.requiredCount} desktops there, but only ${blocker.existingCount} exist.`,
  };
}

export function formatRestoreFailures(failures: RestoreFailure[]): string {
  const summary = failures.map((failure) => `- ${formatFailureLabel(failure)}`).join("\n");
  const details = failures
    .map((failure) => `${formatFailureLabel(failure)}: ${failure.reason}`)
    .join("\n\n");

  return [`Skipped ${failures.length} window${failures.length === 1 ? "" : "s"} during restore:`, summary, "", details].join("\n");
}

function formatMoveLabel(move: RestoredWindowMove): string {
  return move.app;
}

export function formatRestoreMoves(moves: RestoredWindowMove[]): string {
  const moved = moves.filter((move) => move.changedDesktop);
  const unchanged = moves.filter((move) => !move.changedDesktop);
  const sections: string[] = [];

  if (moved.length > 0) {
    sections.push(
      "Moved",
      ...moved.map((move) => {
        const fromDisplay = move.fromDisplayIndex ?? "?";
        const fromSpace = move.fromSpaceIndex ?? "?";
        const toSpace = move.toSpaceIndex ?? "?";

        return `- ${formatMoveLabel(move)} -> display ${move.toDisplayIndex}, desktop ${toSpace} (from display ${fromDisplay}, desktop ${fromSpace})`;
      }),
    );
  }

  if (unchanged.length > 0) {
    if (sections.length > 0) {
      sections.push("");
    }

    sections.push(
      "Already Correct",
      ...unchanged.map((move) => {
        const toSpace = move.toSpaceIndex ?? "?";
        return `- ${formatMoveLabel(move)} didn't move (display ${move.toDisplayIndex}, desktop ${toSpace})`;
      }),
    );
  }

  if (sections.length === 0) {
    return "No windows were restored.";
  }

  return sections.join("\n");
}

export async function restoreLayout(layout: SavedLayout): Promise<RestoreResult> {
  const initialSnapshot = await getSnapshot();
  const plan = createRestorePlan(layout, initialSnapshot);
  const usedWindowIds = new Set<number>();
  const failures: RestoreFailure[] = [];
  const moves: RestoredWindowMove[] = [];
  const blockedDisplays = new Map(plan.spacesToCreate.map((item) => [item.displayId, item]));

  for (const move of plan.windowMoves) {
    const blocker = blockedDisplays.get(move.targetDisplayId);
    if (blocker && move.targetSpacePosition > blocker.existingCount) {
      failures.push(toMissingDesktopFailure(move, blocker));
      continue;
    }

    const currentSnapshot = await getSnapshot();
    const currentWindow = findCurrentWindowForMove(move, currentSnapshot, usedWindowIds);
    if (!currentWindow) {
      continue;
    }

    usedWindowIds.add(currentWindow.id);
    try {
      moves.push(await runWindowMoveSequence(currentWindow.id, move, currentSnapshot));
    } catch (error) {
      if (!isMissingWindowError(error)) {
        failures.push(toRestoreFailure(move, error));
        continue;
      }

      usedWindowIds.delete(currentWindow.id);
      const retrySnapshot = await getSnapshot();
      const retryWindow = findCurrentWindowForMove(move, retrySnapshot, usedWindowIds);
      if (!retryWindow || retryWindow.id === currentWindow.id) {
        failures.push(toRestoreFailure(move, error));
        continue;
      }

      usedWindowIds.add(retryWindow.id);
      try {
        moves.push(await runWindowMoveSequence(retryWindow.id, move, retrySnapshot));
      } catch (retryError) {
        failures.push(toRestoreFailure(move, retryError));
      }
      continue;
    }
  }

  return {plan, failures, moves};
}
