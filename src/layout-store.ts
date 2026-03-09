import { LocalStorage } from "@raycast/api";
import { SavedLayout } from "./types";

const STORAGE_KEY = "saved-window-layouts";

function sortLayouts(layouts: SavedLayout[]): SavedLayout[] {
  return [...layouts].sort((left, right) => left.name.localeCompare(right.name));
}

function parseLayouts(raw: string | undefined | null): SavedLayout[] {
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as SavedLayout[];
  return sortLayouts(parsed);
}

async function persistLayouts(layouts: SavedLayout[]): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(sortLayouts(layouts)));
}

export async function getLayouts(): Promise<SavedLayout[]> {
  return parseLayouts(await LocalStorage.getItem<string>(STORAGE_KEY));
}

export async function getLayout(name: string): Promise<SavedLayout | undefined> {
  const layouts = await getLayouts();
  return layouts.find((layout) => layout.name === name);
}

export async function upsertLayout(layout: SavedLayout): Promise<void> {
  const layouts = await getLayouts();
  const next = layouts.filter((entry) => entry.name !== layout.name);
  next.push(layout);
  await persistLayouts(next);
}

export async function removeLayout(name: string): Promise<void> {
  const layouts = await getLayouts();
  await persistLayouts(layouts.filter((layout) => layout.name !== name));
}

export async function renameLayout(previousName: string, nextName: string): Promise<void> {
  const layouts = await getLayouts();
  await persistLayouts(
    layouts.map((layout) =>
      layout.name === previousName
        ? {
            ...layout,
            name: nextName,
            updatedAt: new Date().toISOString(),
          }
        : layout,
    ),
  );
}

export async function importLayouts(raw: string): Promise<void> {
  await persistLayouts(parseLayouts(raw));
}

export async function exportLayouts(): Promise<string> {
  return JSON.stringify(await getLayouts(), null, 2);
}
