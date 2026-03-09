import { createRestorePlan } from "./planner";
import { PlannedWindowMove, SavedLayout, SystemSnapshot, YabaiSpace, YabaiWindow } from "./types";
import { createSpaceOnDisplay, getSnapshot, moveWindowToDisplay, moveWindowToSpace, resizeWindow } from "./yabai";

function getSpaceForDisplayAndPosition(spaces: YabaiSpace[], displayId: number, position: number): YabaiSpace | undefined {
  return spaces
    .filter((space) => space.display === displayId)
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

export async function restoreLayout(layout: SavedLayout) {
  const initialSnapshot = await getSnapshot();
  const hydratedSnapshot = await ensureSpaces(initialSnapshot, layout);
  const plan = createRestorePlan(layout, hydratedSnapshot);
  const usedWindowIds = new Set<number>();

  for (const move of plan.windowMoves) {
    const currentSnapshot = await getSnapshot();
    const currentWindow = findCurrentWindowForMove(move, currentSnapshot, usedWindowIds);
    if (!currentWindow) {
      continue;
    }

    usedWindowIds.add(currentWindow.id);

    await moveWindowToDisplay(currentWindow.id, move.targetDisplayIndex);

    const targetSpace = getSpaceForDisplayAndPosition(hydratedSnapshot.spaces, move.targetDisplayId, move.targetSpacePosition);
    if (targetSpace) {
      await moveWindowToSpace(currentWindow.id, move.targetSpaceIndex);
    }

    await resizeWindow(currentWindow.id, move.targetFrame);
  }

  return plan;
}
