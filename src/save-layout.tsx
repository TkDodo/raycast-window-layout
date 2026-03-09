import { Action, ActionPanel, Form, Icon, Toast, showToast } from "@raycast/api";
import { useEffect, useState } from "react";
import { createLayoutFromSnapshot } from "./capture";
import { getLayout, getLayouts, upsertLayout } from "./layout-store";
import { getSaveLayoutDraft } from "./save-layout-state";
import { ErrorDetail } from "./ui";
import { formatYabaiRequirementHint } from "./yabai-errors";
import { ensureYabai, getSnapshot, YabaiUnavailableError } from "./yabai";

interface Values {
  existingLayout?: string;
  name: string;
  notes?: string;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<{ name: string; notes?: string }[]>([]);
  const [selectedLayoutName, setSelectedLayoutName] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    async function loadLayouts() {
      const storedLayouts = await getLayouts();
      setLayouts(storedLayouts.map((layout) => ({ name: layout.name, notes: layout.notes })));
    }

    loadLayouts();
  }, []);

  async function handleSubmit(values: Values) {
    setIsLoading(true);
    setError(null);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Saving layout" });

    try {
      const targetName = values.name.trim();
      await ensureYabai();
      const snapshot = await getSnapshot();
      const existing = await getLayout(targetName);
      const layout = createLayoutFromSnapshot(targetName, snapshot, values.notes?.trim());

      if (existing) {
        layout.createdAt = existing.createdAt;
      }

      await upsertLayout(layout);
      const storedLayouts = await getLayouts();
      setLayouts(storedLayouts.map((entry) => ({ name: entry.name, notes: entry.notes })));
      setSelectedLayoutName(layout.name);
      setName(layout.name);
      setNotes(layout.notes ?? "");
      toast.style = Toast.Style.Success;
      toast.title = existing ? "Layout updated" : "Layout saved";
      toast.message = `${layout.windows.length} windows captured`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      toast.style = Toast.Style.Failure;
      toast.title = "Unable to save layout";
      toast.message = message;
      setError(`${message}\n\n${formatYabaiRequirementHint()}`);
    } finally {
      setIsLoading(false);
    }
  }

  if (error) {
    return <ErrorDetail title="Unable to save layout" error={error} onBack={() => setError(null)} />;
  }

  const draft = selectedLayoutName ? getSaveLayoutDraft(layouts, selectedLayoutName) : undefined;
  const isUpdatingExisting = Boolean(draft?.isUpdatingExisting);
  const displayedName = isUpdatingExisting ? draft?.name ?? "" : name;
  const displayedNotes = isUpdatingExisting ? draft?.notes ?? "" : notes;

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm icon={Icon.Download} title="Save Layout" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="existingLayout"
        title="Existing Layout"
        value={selectedLayoutName}
        onChange={(nextSelectedLayoutName) => {
          setSelectedLayoutName(nextSelectedLayoutName);
          const nextDraft = getSaveLayoutDraft(layouts, nextSelectedLayoutName);
          setName(nextDraft.name);
          setNotes(nextDraft.notes);
        }}
      >
        <Form.Dropdown.Item value="" title="Create New Layout" />
        {layouts.map((layout) => (
          <Form.Dropdown.Item key={layout.name} value={layout.name} title={layout.name} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        id="name"
        title="Name"
        placeholder="Work"
        value={displayedName}
        onChange={(newValue) => {
          if (!isUpdatingExisting) {
            setName(newValue);
          }
        }}
        info={isUpdatingExisting ? "Updating an existing layout keeps its current name." : undefined}
      />
      <Form.TextArea
        id="notes"
        title="Notes"
        placeholder="Optional context for this layout"
        value={displayedNotes}
        onChange={(newValue) => setNotes(newValue)}
      />
      <Form.Description
        title="Requirements"
        text={formatYabaiRequirementHint()}
      />
    </Form>
  );
}
