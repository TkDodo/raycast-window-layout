import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  Icon,
  List,
  Toast,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { exportLayouts, getLayouts, importLayouts, removeLayout, renameLayout } from "./layout-store";
import { SavedLayout } from "./types";
import { confirmDelete, EmptyState, layoutAccessories, LayoutJsonDetail } from "./ui";

function RenameLayoutForm(props: { layout: SavedLayout; onDone: () => Promise<void> }) {
  const { pop } = useNavigation();

  async function onSubmit(values: { name: string }) {
    await renameLayout(props.layout.name, values.name.trim());
    await props.onDone();
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Rename Layout" onSubmit={onSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="name" title="Name" defaultValue={props.layout.name} />
    </Form>
  );
}

function ImportLayoutsForm(props: { onDone: () => Promise<void> }) {
  const { pop } = useNavigation();

  async function onSubmit(values: { json: string }) {
    await importLayouts(values.json);
    await props.onDone();
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Import Layouts" onSubmit={onSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextArea id="json" title="JSON" placeholder='[{"name":"Work", ...}]' />
    </Form>
  );
}

export default function Command() {
  const [layouts, setLayouts] = useState<SavedLayout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useNavigation();

  async function loadLayouts() {
    setLayouts(await getLayouts());
    setIsLoading(false);
  }

  useEffect(() => {
    loadLayouts();
  }, []);

  async function handleDelete(layout: SavedLayout) {
    if (!(await confirmDelete(layout.name))) {
      return;
    }

    await removeLayout(layout.name);
    await loadLayouts();
    await showToast({ style: Toast.Style.Success, title: "Layout deleted" });
  }

  async function handleExportAll() {
    await Clipboard.copy(await exportLayouts());
    await showToast({ style: Toast.Style.Success, title: "Copied layouts JSON" });
  }

  return (
    <List isLoading={isLoading}>
      {layouts.length === 0 && !isLoading ? (
        <EmptyState
          title="No saved layouts"
          description="Save a layout first or import an existing JSON export."
          action={<Action.Push title="Import Layouts" icon={Icon.Upload} target={<ImportLayoutsForm onDone={loadLayouts} />} />}
        />
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
              <Action.Push title="View JSON" icon={Icon.Code} target={<LayoutJsonDetail layout={layout} />} />
              <Action.CopyToClipboard
                title="Copy JSON"
                icon={Icon.Clipboard}
                content={JSON.stringify(layout, null, 2)}
              />
              <Action.Push
                title="Rename Layout"
                icon={Icon.Pencil}
                target={<RenameLayoutForm layout={layout} onDone={loadLayouts} />}
              />
              <Action title="Delete Layout" icon={Icon.Trash} style={Action.Style.Destructive} onAction={() => handleDelete(layout)} />
              <Action.Push title="Import Layouts" icon={Icon.Upload} target={<ImportLayoutsForm onDone={loadLayouts} />} />
              <Action title="Copy All Layouts JSON" icon={Icon.Download} onAction={handleExportAll} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
