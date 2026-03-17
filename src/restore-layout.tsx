import { Action, ActionPanel, Icon, List, Toast, showToast } from "@raycast/api";
import { useEffect, useState } from "react";
import { getLayouts, markLayoutUsed } from "./layout-store";
import { buildRestoreReport, restoreLayout } from "./restore";
import { RestoreReport, SavedLayout } from "./types";
import { EmptyState, ErrorDetail, RestoreReportList, layoutAccessories } from "./ui";
import { formatYabaiRequirementHint } from "./yabai-errors";
import { ensureYabai } from "./yabai";

export default function Command() {
  const [layouts, setLayouts] = useState<SavedLayout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportTitle, setReportTitle] = useState("Restore failed");
  const [report, setReport] = useState<RestoreReport | null>(null);

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
      const missingApps = Array.from(new Set(result.plan.unmatchedSavedWindows.map((window) => window.app)));
      const reportData = buildRestoreReport(result.failures, result.moves, missingApps);
      await markLayoutUsed(layout.name);
      setLayouts(await getLayouts());

      if (result.failures.length > 0) {
        toast.style = Toast.Style.Success;
        toast.title = `Restored ${layout.name} with skips`;
        toast.message = `${result.moves.length} windows moved, ${result.failures.length} skipped`;
        setReportTitle(`Restore Report: ${layout.name}`);
        setReport(reportData);
        return;
      }

      toast.style = Toast.Style.Success;
      toast.title = `Restored ${layout.name}`;
      toast.message = `${result.moves.length} windows moved, ${result.plan.unmatchedSavedWindows.length} missing`;
      setReportTitle(`Restore Report: ${layout.name}`);
      setReport(reportData);
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

  if (report) {
    return <RestoreReportList title={reportTitle} report={report} onBack={() => setReport(null)} />;
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
