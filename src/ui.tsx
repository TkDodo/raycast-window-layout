import { Action, ActionPanel, Alert, Clipboard, Color, Detail, Icon, List, Toast, confirmAlert, showToast } from "@raycast/api";
import { ReactNode } from "react";
import { SavedLayout } from "./types";

export function EmptyState(props: { title: string; description: string; action?: ReactNode }) {
  return (
    <List.EmptyView
      title={props.title}
      description={props.description}
      actions={props.action ? <ActionPanel>{props.action}</ActionPanel> : undefined}
    />
  );
}

export function layoutAccessories(layout: SavedLayout): List.Item.Accessory[] {
  return [
    { icon: Icon.AppWindowGrid2x2, text: `${layout.windows.length} windows` },
    { icon: Icon.Desktop, text: `${layout.displays.length} displays` },
    { tag: { value: new Date(layout.updatedAt).toLocaleDateString(), color: Color.SecondaryText } },
  ];
}

export async function showSuccess(title: string, message: string) {
  await showToast({ style: Toast.Style.Success, title, message });
}

export async function showFailure(title: string, message: string) {
  await showToast({ style: Toast.Style.Failure, title, message });
}

export async function confirmDelete(name: string) {
  return confirmAlert({
    title: `Delete ${name}?`,
    message: "This removes the saved layout.",
    primaryAction: {
      title: "Delete Layout",
      style: Alert.ActionStyle.Destructive,
    },
  });
}

export function LayoutJsonDetail(props: { layout: SavedLayout }) {
  return <Detail markdown={`\`\`\`json\n${JSON.stringify(props.layout, null, 2)}\n\`\`\``} />;
}

export function ErrorDetail(props: { title: string; error: string; onBack?: () => void }) {
  const markdown = [`# ${props.title}`, "", "```text", props.error, "```"].join("\n");

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Error" content={props.error} />
          <Action
            title="Copy Error and Hint"
            icon={Icon.Clipboard}
            onAction={async () => {
              await Clipboard.copy(props.error);
              await showToast({ style: Toast.Style.Success, title: "Copied error to clipboard" });
            }}
          />
          {props.onBack ? <Action title="Back" icon={Icon.ArrowLeft} onAction={props.onBack} /> : null}
        </ActionPanel>
      }
    />
  );
}
