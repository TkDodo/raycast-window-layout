import { createRestorePlan } from "./planner";
import {
  PlannedSpaceCreation,
  PlannedWindowMove,
  RestoreFailure,
  RestoreReport,
  RestoreReportItem,
  RestoreResult,
  RestoreWarning,
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
  display: YabaiDisplay,
  position: number,
): YabaiSpace | undefined {
  const spacesByDisplayIndex = spaces.filter((space) => space.display === display.index).sort((left, right) => left.index - right.index);

  if (spacesByDisplayIndex.length > 0) {
    return spacesByDisplayIndex.at(position - 1);
  }

  const spacesByDisplayId = spaces.filter((space) => space.display === display.id).sort((left, right) => left.index - right.index);
  if (spacesByDisplayId.length > 0) {
    return spacesByDisplayId.at(position - 1);
  }

  const displaySpaceRefs = new Set(display.spaces);
  return spaces
    .filter((space) => displaySpaceRefs.has(space.id) || displaySpaceRefs.has(space.index))
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

function findDisplayById(displays: YabaiDisplay[], displayId: number): YabaiDisplay | undefined {
  return displays.find((display) => display.id === displayId);
}

function findWindowDisplay(snapshot: SystemSnapshot, window: YabaiWindow): YabaiDisplay | undefined {
  const byIndex = snapshot.displays.find((display) => display.index === window.display);
  if (byIndex) {
    const hasWindowSpace = snapshot.spaces.some(
      (space) => (space.display === byIndex.id || space.display === byIndex.index) && (space.id === window.space || space.index === window.space),
    );
    if (hasWindowSpace) {
      return byIndex;
    }
  }

  return snapshot.displays.find((display) => display.id === window.display);
}

function resolveWindowSpace(snapshot: SystemSnapshot, window: YabaiWindow): YabaiSpace | undefined {
  const currentDisplay = findWindowDisplay(snapshot, window);
  const displayId = currentDisplay?.id ?? window.display;
  const displayIndex = currentDisplay?.index ?? window.display;

  return (
    snapshot.spaces.find((space) => (space.display === displayId || space.display === displayIndex) && space.index === window.space) ??
    snapshot.spaces.find((space) => (space.display === displayId || space.display === displayIndex) && space.id === window.space) ??
    snapshot.spaces.find((space) => space.id === window.space) ??
    snapshot.spaces.find((space) => space.index === window.space)
  );
}

function describeWindowLocation(snapshot: SystemSnapshot, window: YabaiWindow): string {
  const display = findWindowDisplay(snapshot, window);
  const space = resolveWindowSpace(snapshot, window);

  return `display ${display?.index ?? "?"}, desktop ${space?.index ?? "?"}`;
}

class UnsupportedDesktopMoveError extends Error {
  constructor(
    move: PlannedWindowMove,
    snapshot: SystemSnapshot,
    window: YabaiWindow,
    targetSpace: YabaiSpace,
  ) {
    super(
      `Desktop move skipped: yabai reported success moving it to display ${move.targetDisplayIndex}, desktop ${targetSpace.index}, but it remained on ${describeWindowLocation(snapshot, window)}. Ensure the yabai scripting addition is installed and loaded, then try again.`,
    );
    this.name = "UnsupportedDesktopMoveError";
  }
}

class InaccessibleWindowWarning extends Error {
  constructor(move: PlannedWindowMove) {
    super(
      `Skipped because yabai has no macOS Accessibility reference for this untitled window. Focus or reopen ${move.app}, then retry.`,
    );
    this.name = "InaccessibleWindowWarning";
  }
}

function isWindowOnTargetDesktop(
  move: PlannedWindowMove,
  snapshot: SystemSnapshot,
  movedWindow: YabaiWindow,
  targetSpace: YabaiSpace,
): boolean {
  const movedDisplay = findWindowDisplay(snapshot, movedWindow);
  const movedSpace = resolveWindowSpace(snapshot, movedWindow);

  return movedDisplay?.index === move.targetDisplayIndex && movedSpace?.index === targetSpace.index;
}

async function assertDesktopMoveApplied(
  move: PlannedWindowMove,
  windowId: number,
  targetSpace: YabaiSpace | undefined,
): Promise<void> {
  if (!targetSpace) {
    return;
  }

  const snapshot = await getSnapshot();
  const movedWindow = snapshot.windows.find((window) => window.id === windowId);
  if (!movedWindow) {
    return;
  }

  if (isWindowOnTargetDesktop(move, snapshot, movedWindow, targetSpace)) {
    return;
  }

  throw new UnsupportedDesktopMoveError(move, snapshot, movedWindow, targetSpace);
}

function framesMatch(current: YabaiWindow["frame"], target: PlannedWindowMove["targetFrame"]): boolean {
  return current.x === target.x && current.y === target.y && current.w === target.w && current.h === target.h;
}

async function runWindowMoveSequence(
  windowId: number,
  move: PlannedWindowMove,
  snapshot: SystemSnapshot,
): Promise<RestoredWindowMove> {
  const currentWindow = snapshot.windows.find((window) => window.id === windowId);
  const currentDisplay = currentWindow ? findWindowDisplay(snapshot, currentWindow) : undefined;
  const currentSpace = currentWindow ? resolveWindowSpace(snapshot, currentWindow) : undefined;

  if (currentWindow?.title.trim() === "" && currentWindow.hasAxReference === false) {
    throw new InaccessibleWindowWarning(move);
  }

  const targetDisplay = findDisplayById(snapshot.displays, move.targetDisplayId);
  const targetSpace = targetDisplay
    ? getSpaceForDisplayAndPosition(snapshot.spaces, targetDisplay, move.targetSpacePosition)
    : undefined;
  const displayChanged = currentDisplay?.index !== move.targetDisplayIndex;
  const desktopChanged = displayChanged || currentSpace?.index !== (targetSpace?.index ?? null);
  const frameChanged = !currentWindow || !framesMatch(currentWindow.frame, move.targetFrame);

  if (displayChanged) {
    await moveWindowToDisplay(windowId, move.targetDisplayIndex);
  }

  if (desktopChanged || frameChanged) {
    await resizeWindow(windowId, move.targetFrame);
  }

  if (targetSpace && desktopChanged) {
    await moveWindowToSpace(windowId, targetSpace.index);
    await assertDesktopMoveApplied(move, windowId, targetSpace);
  }

  return {
    windowId,
    app: move.app,
    title: move.title,
    matchedBy: move.matchedBy,
    fromDisplayIndex: currentDisplay?.index ?? null,
    fromSpaceIndex: currentSpace?.index ?? null,
    toDisplayIndex: move.targetDisplayIndex,
    toSpaceIndex: targetSpace?.index ?? null,
    changedDesktop: desktopChanged,
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

function toRestoreWarning(move: PlannedWindowMove, warning: InaccessibleWindowWarning): RestoreWarning {
  return {
    app: move.app,
    title: move.title,
    reason: warning.message,
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

function toWarningItem(warning: RestoreWarning): RestoreReportItem {
  return {
    title: formatFailureLabel(warning),
    subtitle: warning.reason,
    tint: "yellow",
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
  warnings: RestoreWarning[] = [],
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

  if (warnings.length > 0) {
    sections.push({
      title: "Warnings",
      items: warnings.map(toWarningItem),
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
  const warnings: RestoreWarning[] = [];
  const pendingMissingWindowFailures = new Map<string, RestoreFailure>();
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
        pendingMissingWindowFailures.delete(move.savedWindowId);
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
        pendingMissingWindowFailures.delete(move.savedWindowId);
        progressed = true;
      } catch (error) {
        if (error instanceof InaccessibleWindowWarning) {
          warnings.push(toRestoreWarning(move, error));
          handledSavedWindowIds.add(move.savedWindowId);
          pendingMissingWindowFailures.delete(move.savedWindowId);
          continue;
        }

        if (!isMissingWindowError(error)) {
          failures.push(toRestoreFailure(move, error));
          handledSavedWindowIds.add(move.savedWindowId);
          pendingMissingWindowFailures.delete(move.savedWindowId);
          continue;
        }

        usedWindowIds.delete(currentWindow.id);
        const retrySnapshot = await getSnapshot();
        const retryWindow = findCurrentWindowForMove(move, retrySnapshot, usedWindowIds);
        if (!retryWindow) {
          pendingMissingWindowFailures.set(move.savedWindowId, toRestoreFailure(move, error));
          continue;
        }

        usedWindowIds.add(retryWindow.id);
        try {
          moves.push(await runWindowMoveSequence(retryWindow.id, move, retrySnapshot));
          handledSavedWindowIds.add(move.savedWindowId);
          pendingMissingWindowFailures.delete(move.savedWindowId);
          progressed = true;
        } catch (retryError) {
          if (retryError instanceof InaccessibleWindowWarning) {
            warnings.push(toRestoreWarning(move, retryError));
            handledSavedWindowIds.add(move.savedWindowId);
            pendingMissingWindowFailures.delete(move.savedWindowId);
            continue;
          }

          if (isMissingWindowError(retryError)) {
            usedWindowIds.delete(retryWindow.id);
            pendingMissingWindowFailures.set(move.savedWindowId, toRestoreFailure(move, retryError));
            continue;
          }

          failures.push(toRestoreFailure(move, retryError));
          handledSavedWindowIds.add(move.savedWindowId);
          pendingMissingWindowFailures.delete(move.savedWindowId);
        }
      }
    }

    if (!progressed && pendingMissingWindowFailures.size === 0) {
      break;
    }
  }

  for (const [savedWindowId, failure] of pendingMissingWindowFailures) {
    if (!handledSavedWindowIds.has(savedWindowId)) {
      failures.push(failure);
      handledSavedWindowIds.add(savedWindowId);
    }
  }

  return { plan: latestPlan, failures, warnings, moves };
}
