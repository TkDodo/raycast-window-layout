import { Action, ActionPanel, Icon, List, Toast, showToast } from "@raycast/api";
import { useEffect, useState } from "react";
import { getLayouts } from "./layout-store";
import { formatRestoreFailures, restoreLayout } from "./restore";
import { SavedLayout } from "./types";
import { EmptyState, ErrorDetail, layoutAccessories } from "./ui";
import { formatYabaiRequirementHint } from "./yabai-errors";
import { ensureYabai } from "./yabai";

export default function Command() {
  const [layouts, setLayouts] = useState<SavedLayout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState("Restore failed");

  useEffect(() => {
    async function load() {
      try {
        await ensureYabai();
        setLayouts(await getLayouts());
      } catch (loadError) {
        setReportTitle("Restore failed");
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
      const result = await restoreLayout(layout);
      if (result.failures.length > 0) {
        toast.style = Toast.Style.Success;
        toast.title = `Restored ${layout.name} with skips`;
        toast.message = `${result.plan.windowMoves.length - result.failures.length} windows moved, ${result.failures.length} skipped`;
        setReportTitle("Restore Completed With Skips");
        setError(`${formatRestoreFailures(result.failures)}\n\n${formatYabaiRequirementHint()}`);
        return;
      }

      toast.style = Toast.Style.Success;
      toast.title = `Restored ${layout.name}`;
      toast.message = `${result.plan.windowMoves.length} windows moved, ${result.plan.unmatchedSavedWindows.length} missing`;
    } catch (restoreError) {
      const message = restoreError instanceof Error ? restoreError.message : "Unexpected error";
      toast.style = Toast.Style.Failure;
      toast.title = "Restore failed";
      toast.message = message;
      setReportTitle("Restore failed");
      setError(`${message}\n\n${formatYabaiRequirementHint()}`);
    }
  }

  if (error) {
    return <ErrorDetail title={reportTitle} error={error} onBack={() => setError(null)} />;
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
