export type WindowMatchMode = "app";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DisplayFingerprint {
  uuid: string | null;
  arrangementIndex: number;
  frame: Rect;
  label: string;
}

export interface SavedWindow {
  id: string;
  app: string;
  title: string;
  matchMode: WindowMatchMode;
  targetDisplayId: string;
  targetSpaceIndex: number;
  targetSpacePosition: number;
  targetFrame: Rect;
}

export interface SavedLayout {
  name: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  displays: DisplayFingerprint[];
  windows: SavedWindow[];
}

export interface YabaiDisplay {
  id: number;
  uuid?: string | null;
  index: number;
  frame: Rect;
  spaces: number[];
  label?: string;
}

export interface YabaiSpace {
  id: number;
  index: number;
  display: number;
  label?: string;
}

export interface YabaiWindow {
  id: number;
  app: string;
  title: string;
  display: number;
  space: number;
  frame: Rect;
  isMinimized?: boolean;
  isHidden?: boolean;
  isVisible?: boolean;
}

export interface SystemSnapshot {
  displays: YabaiDisplay[];
  spaces: YabaiSpace[];
  windows: YabaiWindow[];
}

export interface DisplayMatch {
  layoutDisplayId: string;
  currentDisplayId: number;
  currentDisplayIndex: number;
}

export interface PlannedSpaceCreation {
  displayId: number;
  requiredCount: number;
  existingCount: number;
}

export interface PlannedWindowMove {
  windowId: number;
  app: string;
  title: string;
  targetDisplayId: number;
  targetDisplayIndex: number;
  targetSpaceIndex: number;
  targetSpacePosition: number;
  targetFrame: Rect;
  matchedBy: "title" | "app";
}

export interface RestorePlan {
  displayMatches: DisplayMatch[];
  spacesToCreate: PlannedSpaceCreation[];
  windowMoves: PlannedWindowMove[];
  unmatchedSavedWindows: SavedWindow[];
  unmatchedCurrentWindows: YabaiWindow[];
}

export interface RestoreFailure {
  app: string;
  title: string;
  reason: string;
}

export interface RestoredWindowMove {
  windowId: number;
  app: string;
  title: string;
  matchedBy: "title" | "app";
  fromDisplayIndex: number | null;
  fromSpaceIndex: number | null;
  toDisplayIndex: number;
  toSpaceIndex: number | null;
  changedDesktop: boolean;
}

export interface RestoreResult {
  plan: RestorePlan;
  failures: RestoreFailure[];
  moves: RestoredWindowMove[];
}
