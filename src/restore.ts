import { createRestorePlan } from "./planner";
import {
  PlannedSpaceCreation,
  PlannedWindowMove,
  RestoreFailure,
  RestoreReport,
  RestoreReportItem,
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

function formatMoveLabel(move: RestoredWindowMove): string {
  return move.app;
}

function toProblemItem(failure: RestoreFailure): RestoreReportItem {
  return {
    title: formatFailureLabel(failure),
    subtitle: failure.reason,
    tint: "red",
  };
}

function toMovedItem(move: RestoredWindowMove): RestoreReportItem {
  const fromDisplay = move.fromDisplayIndex ?? "?";
  const fromSpace = move.fromSpaceIndex ?? "?";
  const toSpace = move.toSpaceIndex ?? "?";

  return {
    title: formatMoveLabel(move),
    subtitle: `display ${fromDisplay}, desktop ${fromSpace} -> display ${move.toDisplayIndex}, desktop ${toSpace}`,
    details: `Matched by ${move.matchedBy}`,
    tint: "green",
  };
}

function toUnchangedItem(move: RestoredWindowMove): RestoreReportItem {
  const toSpace = move.toSpaceIndex ?? "?";

  return {
    title: formatMoveLabel(move),
    subtitle: `didn't move (display ${move.toDisplayIndex}, desktop ${toSpace})`,
    details: `Matched by ${move.matchedBy}`,
    tint: "white",
  };
}

export function buildRestoreReport(
  failures: RestoreFailure[],
  moves: RestoredWindowMove[],
  missingApps: string[],
): RestoreReport {
  const moved = moves.filter((move) => move.changedDesktop);
  const unchanged = moves.filter((move) => !move.changedDesktop);
  const sections = [];

  if (failures.length > 0) {
    sections.push({
      title: "Problems",
      items: failures.map(toProblemItem),
    });
  }

  if (moved.length > 0) {
    sections.push({
      title: "Moved",
      items: moved.map(toMovedItem),
    });
  }

  if (unchanged.length > 0) {
    sections.push({
      title: "Already Correct",
      items: unchanged.map(toUnchangedItem),
    });
  }

  if (missingApps.length > 0) {
    sections.push({
      title: "Missing",
      items: missingApps.map((app) => ({
        title: app,
        subtitle: "Not currently open",
        tint: "white" as const,
      })),
    });
  }

  return { sections };
}

export async function restoreLayout(layout: SavedLayout): Promise<RestoreResult> {
  const handledSavedWindowIds = new Set<string>();
  const failures: RestoreFailure[] = [];
  const moves: RestoredWindowMove[] = [];
  let latestPlan: ReturnType<typeof createRestorePlan> = {
    displayMatches: [],
    spacesToCreate: [],
    windowMoves: [],
    unmatchedSavedWindows: layout.windows,
    unmatchedCurrentWindows: [],
  };

  for (let pass = 0; pass < 2; pass += 1) {
    const remainingLayout: SavedLayout = {
      ...layout,
      windows: layout.windows.filter((window) => !handledSavedWindowIds.has(window.id)),
    };

    if (remainingLayout.windows.length === 0) {
      break;
    }

    const passSnapshot = await getSnapshot();
    const plan = createRestorePlan(remainingLayout, passSnapshot);
    latestPlan = plan;

    if (plan.windowMoves.length === 0) {
      break;
    }

    const usedWindowIds = new Set<number>();
    const blockedDisplays = new Map(plan.spacesToCreate.map((item) => [item.displayId, item]));
    let progressed = false;

    for (const move of plan.windowMoves) {
      const blocker = blockedDisplays.get(move.targetDisplayId);
      if (blocker && move.targetSpacePosition > blocker.existingCount) {
        failures.push(toMissingDesktopFailure(move, blocker));
        handledSavedWindowIds.add(move.savedWindowId);
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
        handledSavedWindowIds.add(move.savedWindowId);
        progressed = true;
      } catch (error) {
        if (!isMissingWindowError(error)) {
          failures.push(toRestoreFailure(move, error));
          handledSavedWindowIds.add(move.savedWindowId);
          continue;
        }

        usedWindowIds.delete(currentWindow.id);
        const retrySnapshot = await getSnapshot();
        const retryWindow = findCurrentWindowForMove(move, retrySnapshot, usedWindowIds);
        if (!retryWindow || retryWindow.id === currentWindow.id) {
          failures.push(toRestoreFailure(move, error));
          handledSavedWindowIds.add(move.savedWindowId);
          continue;
        }

        usedWindowIds.add(retryWindow.id);
        try {
          moves.push(await runWindowMoveSequence(retryWindow.id, move, retrySnapshot));
          handledSavedWindowIds.add(move.savedWindowId);
          progressed = true;
        } catch (retryError) {
          failures.push(toRestoreFailure(move, retryError));
          handledSavedWindowIds.add(move.savedWindowId);
        }
      }
    }

    if (!progressed) {
      break;
    }
  }

  return {plan: latestPlan, failures, moves};
}
