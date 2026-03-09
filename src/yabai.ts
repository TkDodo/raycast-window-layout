import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { SystemSnapshot, YabaiDisplay, YabaiSpace, YabaiWindow } from "./types";

const execFileAsync = promisify(execFile);

export class YabaiUnavailableError extends Error {
  constructor(message = "yabai is not installed, not running, or not accessible from Raycast.") {
    super(message);
    this.name = "YabaiUnavailableError";
  }
}

async function runYabaiJson<T>(args: string[]): Promise<T> {
  try {
    const { stdout } = await execFileAsync("yabai", ["-m", ...args]);
    return JSON.parse(stdout) as T;
  } catch (error) {
    throw new YabaiUnavailableError(error instanceof Error ? error.message : undefined);
  }
}

async function runYabai(args: string[]): Promise<void> {
  try {
    await execFileAsync("yabai", ["-m", ...args]);
  } catch (error) {
    throw new YabaiUnavailableError(error instanceof Error ? error.message : undefined);
  }
}

export async function ensureYabai(): Promise<void> {
  await runYabaiJson<YabaiDisplay[]>(["query", "--displays"]);
}

export async function getSnapshot(): Promise<SystemSnapshot> {
  const [displays, spaces, windows] = await Promise.all([
    runYabaiJson<YabaiDisplay[]>(["query", "--displays"]),
    runYabaiJson<YabaiSpace[]>(["query", "--spaces"]),
    runYabaiJson<YabaiWindow[]>(["query", "--windows"]),
  ]);

  return { displays, spaces, windows };
}

export async function createSpaceOnDisplay(displayId: number): Promise<void> {
  await runYabai(["display", "--focus", String(displayId)]);
  await runYabai(["space", "--create"]);
}

export async function moveWindowToSpace(windowId: number, spaceIndex: number): Promise<void> {
  await runYabai(["window", String(windowId), "--space", String(spaceIndex)]);
}

export async function moveWindowToDisplay(windowId: number, displayId: number): Promise<void> {
  await runYabai(["window", String(windowId), "--display", String(displayId)]);
}

export async function resizeWindow(windowId: number, frame: { x: number; y: number; w: number; h: number }): Promise<void> {
  await runYabai(["window", String(windowId), "--move", `abs:${frame.x}:${frame.y}`]);
  await runYabai(["window", String(windowId), "--resize", `abs:${frame.w}:${frame.h}`]);
}
