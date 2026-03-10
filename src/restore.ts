import { createRestorePlan } from "./planner";
import { PlannedWindowMove, RestoreFailure, RestoreResult, SavedLayout, SystemSnapshot, YabaiSpace, YabaiWindow } from "./types";
import { createSpaceOnDisplay, getSnapshot, moveWindowToDisplay, moveWindowToSpace, resizeWindow } from "./yabai";

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

async function ensureSpaces(snapshot: SystemSnapshot, layout: SavedLayout) {
  const initialPlan = createRestorePlan(layout, snapshot);

  for (const item of initialPlan.spacesToCreate) {
    const missingCount = item.requiredCount - item.existingCount;
    for (let i = 0; i < missingCount; i += 1) {
      await createSpaceOnDisplay(item.displayId);
    }
  }

  if (initialPlan.spacesToCreate.length > 0) {
    return getSnapshot();
  }

  return snapshot;
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

async function runWindowMoveSequence(windowId: number, move: PlannedWindowMove, spaces: YabaiSpace[]) {
  await moveWindowToDisplay(windowId, move.targetDisplayIndex);

  const targetSpace = getSpaceForDisplayAndPosition(spaces, move.targetDisplayId, move.targetDisplayIndex, move.targetSpacePosition);
  if (targetSpace) {
    await moveWindowToSpace(windowId, targetSpace.index);
  }

  await resizeWindow(windowId, move.targetFrame);
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

export function formatRestoreFailures(failures: RestoreFailure[]): string {
  const summary = failures.map((failure) => `- ${formatFailureLabel(failure)}`).join("\n");
  const details = failures
    .map((failure) => `${formatFailureLabel(failure)}: ${failure.reason}`)
    .join("\n\n");

  return [`Skipped ${failures.length} window${failures.length === 1 ? "" : "s"} during restore:`, summary, "", details].join("\n");
}

export async function restoreLayout(layout: SavedLayout): Promise<RestoreResult> {
  const initialSnapshot = await getSnapshot();
  const hydratedSnapshot = await ensureSpaces(initialSnapshot, layout);
  const plan = createRestorePlan(layout, hydratedSnapshot);
  const usedWindowIds = new Set<number>();
  const failures: RestoreFailure[] = [];

  for (const move of plan.windowMoves) {
    const currentSnapshot = await getSnapshot();
    const currentWindow = findCurrentWindowForMove(move, currentSnapshot, usedWindowIds);
    if (!currentWindow) {
      continue;
    }

    usedWindowIds.add(currentWindow.id);
    try {
      await runWindowMoveSequence(currentWindow.id, move, hydratedSnapshot.spaces);
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
        await runWindowMoveSequence(retryWindow.id, move, hydratedSnapshot.spaces);
      } catch (retryError) {
        failures.push(toRestoreFailure(move, retryError));
      }
      continue;
    }
  }

  return {plan, failures};
}
