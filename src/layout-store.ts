import { LocalStorage } from "@raycast/api";
import { SavedLayout } from "./types";

const STORAGE_KEY = "saved-window-layouts";

function sortLayouts(layouts: SavedLayout[]): SavedLayout[] {
  return [...layouts].sort((left, right) => {
    const leftUsedAt = left.lastUsedAt ? new Date(left.lastUsedAt).getTime() : 0;
    const rightUsedAt = right.lastUsedAt ? new Date(right.lastUsedAt).getTime() : 0;

    if (leftUsedAt !== rightUsedAt) {
      return rightUsedAt - leftUsedAt;
    }

    return left.name.localeCompare(right.name);
  });
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
  const existing = layouts.find((entry) => entry.name === layout.name);
  const next = layouts.filter((entry) => entry.name !== layout.name);
  next.push({
    ...layout,
    lastUsedAt: layout.lastUsedAt ?? existing?.lastUsedAt,
  });
  await persistLayouts(next);
}

export async function markLayoutUsed(name: string): Promise<void> {
  const layouts = await getLayouts();
  const timestamp = new Date().toISOString();
  await persistLayouts(
    layouts.map((layout) =>
      layout.name === name
        ? {
            ...layout,
            lastUsedAt: timestamp,
          }
        : layout,
    ),
  );
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
