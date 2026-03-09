import { Action, ActionPanel, Form, Icon, Toast, showToast } from "@raycast/api";
import { useState } from "react";
import { createLayoutFromSnapshot } from "./capture";
import { getLayout, upsertLayout } from "./layout-store";
import { ErrorDetail } from "./ui";
import { formatYabaiRequirementHint } from "./yabai-errors";
import { ensureYabai, getSnapshot, YabaiUnavailableError } from "./yabai";

interface Values {
  name: string;
  notes?: string;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: Values) {
    setIsLoading(true);
    setError(null);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Saving layout" });

    try {
      await ensureYabai();
      const snapshot = await getSnapshot();
      const existing = await getLayout(values.name);
      const layout = createLayoutFromSnapshot(values.name.trim(), snapshot, values.notes?.trim());

      if (existing) {
        layout.createdAt = existing.createdAt;
      }

      await upsertLayout(layout);
      toast.style = Toast.Style.Success;
      toast.title = existing ? "Layout updated" : "Layout saved";
      toast.message = `${layout.windows.length} windows captured`;
    } catch (error) {
      const message = error instanceof YabaiUnavailableError ? error.message : "Unexpected error";
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

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm icon={Icon.Download} title="Save Layout" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Name" placeholder="Work" />
      <Form.TextArea id="notes" title="Notes" placeholder="Optional context for this layout" />
      <Form.Description
        title="Requirements"
        text={formatYabaiRequirementHint()}
      />
    </Form>
  );
}
