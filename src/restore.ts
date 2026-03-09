import { createRestorePlan } from "./planner";
import { SavedLayout, SystemSnapshot, YabaiSpace } from "./types";
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

export async function restoreLayout(layout: SavedLayout) {
  const initialSnapshot = await getSnapshot();
  const hydratedSnapshot = await ensureSpaces(initialSnapshot, layout);
  const plan = createRestorePlan(layout, hydratedSnapshot);

  for (const move of plan.windowMoves) {
    await moveWindowToDisplay(move.windowId, move.targetDisplayIndex);

    const targetSpace = getSpaceForDisplayAndPosition(hydratedSnapshot.spaces, move.targetDisplayId, move.targetSpaceIndex);
    if (targetSpace) {
      await moveWindowToSpace(move.windowId, targetSpace.index);
    }

    await resizeWindow(move.windowId, move.targetFrame);
  }

  return plan;
}
