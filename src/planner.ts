import {
  DisplayFingerprint,
  RestorePlan,
  SavedLayout,
  SavedWindow,
  SystemSnapshot,
  YabaiDisplay,
  YabaiWindow,
} from "./types";

function fingerprintId(display: DisplayFingerprint): string {
  return display.uuid ?? `${display.arrangementIndex}:${display.frame.w}x${display.frame.h}:${display.label}`;
}

function candidateScore(saved: DisplayFingerprint, current: YabaiDisplay): number {
  let score = 0;
  if (saved.uuid && current.uuid && saved.uuid === current.uuid) {
    score += 100;
  }
  if (saved.arrangementIndex === current.index) {
    score += 10;
  }
  if (saved.frame.w === current.frame.w && saved.frame.h === current.frame.h) {
    score += 5;
  }
  const currentLabel = current.label ?? `Display ${current.index}`;
  if (saved.label === currentLabel) {
    score += 1;
  }
  return score;
}

function matchDisplays(layout: SavedLayout, snapshot: SystemSnapshot): Map<string, YabaiDisplay> {
  const remaining = [...snapshot.displays];
  const matches = new Map<string, YabaiDisplay>();

  for (const savedDisplay of layout.displays) {
    const ranked = remaining
      .map((current) => ({ current, score: candidateScore(savedDisplay, current) }))
      .sort((left, right) => right.score - left.score);

    const best = ranked[0];
    if (!best || best.score <= 0) {
      continue;
    }

    matches.set(fingerprintId(savedDisplay), best.current);
    remaining.splice(
      remaining.findIndex((display) => display.id === best.current.id),
      1,
    );
  }

  return matches;
}

function findCurrentWindows(snapshot: SystemSnapshot): YabaiWindow[] {
  return snapshot.windows.filter((window) => !window.isHidden && !window.isMinimized && window.isVisible !== false);
}

function rankWindowMatch(savedWindow: SavedWindow, candidate: YabaiWindow): { score: number; matchedBy?: "title" | "app" } {
  if (savedWindow.app !== candidate.app) {
    return { score: -1 };
  }

  if (savedWindow.title && candidate.title === savedWindow.title) {
    return { score: 2, matchedBy: "title" };
  }

  return { score: 1, matchedBy: "app" };
}

export function createRestorePlan(layout: SavedLayout, snapshot: SystemSnapshot): RestorePlan {
  const displayMatches = matchDisplays(layout, snapshot);
  const currentWindows = findCurrentWindows(snapshot);
  const unmatchedCurrent = [...currentWindows];
  const unmatchedSaved: SavedWindow[] = [];
  const windowMoves = [];

  for (const savedWindow of layout.windows) {
    const targetDisplay = displayMatches.get(savedWindow.targetDisplayId);
    if (!targetDisplay) {
      unmatchedSaved.push(savedWindow);
      continue;
    }

    const ranked = unmatchedCurrent
      .map((candidate) => ({ candidate, ...rankWindowMatch(savedWindow, candidate) }))
      .filter((item) => item.score >= 0)
      .sort((left, right) => right.score - left.score || left.candidate.id - right.candidate.id);

    const match = ranked[0];
    if (!match || !match.matchedBy) {
      unmatchedSaved.push(savedWindow);
      continue;
    }

    windowMoves.push({
      windowId: match.candidate.id,
      app: match.candidate.app,
      title: match.candidate.title,
      targetDisplayId: targetDisplay.id,
      targetDisplayIndex: targetDisplay.index,
      targetSpaceIndex: savedWindow.targetSpaceIndex,
      targetSpacePosition: savedWindow.targetSpacePosition,
      targetFrame: savedWindow.targetFrame,
      matchedBy: match.matchedBy,
    });

    unmatchedCurrent.splice(
      unmatchedCurrent.findIndex((window) => window.id === match.candidate.id),
      1,
    );
  }

  const spacesToCreate = Array.from(displayMatches.values()).flatMap((currentDisplay) => {
    const savedSpaceCount = layout.windows
      .filter((window) => displayMatches.get(window.targetDisplayId)?.id === currentDisplay.id)
      .reduce((max, window) => Math.max(max, window.targetSpacePosition), 0);

    const existingCount = currentDisplay.spaces.length;
    if (savedSpaceCount <= existingCount) {
      return [];
    }

    return [
      {
        displayId: currentDisplay.id,
        requiredCount: savedSpaceCount,
        existingCount,
      },
    ];
  });

  return {
    displayMatches: Array.from(displayMatches.entries()).map(([layoutDisplayId, currentDisplay]) => ({
      layoutDisplayId,
      currentDisplayId: currentDisplay.id,
      currentDisplayIndex: currentDisplay.index,
    })),
    spacesToCreate,
    windowMoves,
    unmatchedSavedWindows: unmatchedSaved,
    unmatchedCurrentWindows: unmatchedCurrent,
  };
}
