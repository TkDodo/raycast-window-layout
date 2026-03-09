import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";
import { SystemSnapshot, YabaiDisplay, YabaiSpace, YabaiWindow } from "./types";

const execFileAsync = promisify(execFile);
const YABAI_CANDIDATES = [
  process.env.YABAI_PATH,
  "yabai",
  "/opt/homebrew/bin/yabai",
  "/usr/local/bin/yabai",
  "/opt/local/bin/yabai",
].filter((value): value is string => Boolean(value));

export class YabaiUnavailableError extends Error {
  constructor(message = "yabai is not installed, not running, or not accessible from Raycast.") {
    super(message);
    this.name = "YabaiUnavailableError";
  }
}

async function isExecutable(command: string): Promise<boolean> {
  if (command === "yabai") {
    return true;
  }

  try {
    await access(command);
    return true;
  } catch {
    return false;
  }
}

async function resolveYabaiBinary(): Promise<string> {
  for (const candidate of YABAI_CANDIDATES) {
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  throw new YabaiUnavailableError(
    "Could not find the yabai binary. Install yabai or set YABAI_PATH, then restart Raycast.",
  );
}

function toYabaiError(error: unknown, command: string): YabaiUnavailableError {
  if (!(error instanceof Error)) {
    return new YabaiUnavailableError("Unable to talk to yabai due to an unknown error.");
  }

  const message = "message" in error ? String(error.message) : "";
  const cause = "cause" in error ? String(error.cause) : "";
  const combined = [message, cause].join(" ").trim();

  if (combined.includes("ENOENT")) {
    return new YabaiUnavailableError(
      `Raycast could not find yabai at ${command}. Install it in a standard location or set YABAI_PATH, then restart Raycast.`,
    );
  }

  if (combined.includes("failed to connect to socket")) {
    return new YabaiUnavailableError(
      `Found yabai at ${command}, but it is not running or not reachable. Start the yabai service and try again.`,
    );
  }

  if (combined.includes("cannot connect to socket")) {
    return new YabaiUnavailableError(
      `Found yabai at ${command}, but Raycast could not connect to the yabai socket. Check that yabai is running and restart Raycast if needed.`,
    );
  }

  if (combined.includes("cannot focus display") || combined.includes("cannot focus space")) {
    return new YabaiUnavailableError(
      `yabai is running, but Space management is not available. Check your yabai scripting addition and macOS permissions.`,
    );
  }

  return new YabaiUnavailableError(`yabai command failed: ${combined || "unknown error"}`);
}

async function runYabaiJson<T>(args: string[]): Promise<T> {
  const command = await resolveYabaiBinary();

  try {
    const { stdout } = await execFileAsync(command, ["-m", ...args]);
    return JSON.parse(stdout) as T;
  } catch (error) {
    throw toYabaiError(error, command);
  }
}

async function runYabai(args: string[]): Promise<void> {
  const command = await resolveYabaiBinary();

  try {
    await execFileAsync(command, ["-m", ...args]);
  } catch (error) {
    throw toYabaiError(error, command);
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
