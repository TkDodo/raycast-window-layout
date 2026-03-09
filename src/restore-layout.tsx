import { Action, ActionPanel, Icon, List, Toast, showToast } from "@raycast/api";
import { useEffect, useState } from "react";
import { getLayouts } from "./layout-store";
import { restoreLayout } from "./restore";
import { SavedLayout } from "./types";
import { EmptyState, layoutAccessories } from "./ui";
import { ensureYabai, YabaiUnavailableError } from "./yabai";

export default function Command() {
  const [layouts, setLayouts] = useState<SavedLayout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await ensureYabai();
        setLayouts(await getLayouts());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load layouts");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  async function handleRestore(layout: SavedLayout) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Restoring ${layout.name}` });

    try {
      const plan = await restoreLayout(layout);
      toast.style = Toast.Style.Success;
      toast.title = `Restored ${layout.name}`;
      toast.message = `${plan.windowMoves.length} windows moved, ${plan.unmatchedSavedWindows.length} missing`;
    } catch (restoreError) {
      toast.style = Toast.Style.Failure;
      toast.title = "Restore failed";
      toast.message = restoreError instanceof YabaiUnavailableError ? restoreError.message : "Unexpected error";
    }
  }

  if (error) {
    return <List>{<EmptyState title="yabai unavailable" description={error} />}</List>;
  }

  return (
    <List isLoading={isLoading}>
      {layouts.length === 0 && !isLoading ? (
        <EmptyState title="No saved layouts" description="Save a layout first, then restore it from here." />
      ) : null}
      {layouts.map((layout) => (
        <List.Item
          key={layout.name}
          icon={Icon.AppWindowGrid2x2}
          title={layout.name}
          subtitle={layout.notes}
          accessories={layoutAccessories(layout)}
          actions={
            <ActionPanel>
              <Action title="Restore Layout" icon={Icon.Play} onAction={() => handleRestore(layout)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
