export interface SaveLayoutOption {
  name: string;
  notes?: string;
}

export interface SaveLayoutDraft {
  selectedLayoutName: string;
  name: string;
  notes: string;
  isUpdatingExisting: boolean;
}

export function getSaveLayoutDraft(layouts: SaveLayoutOption[], selectedLayoutName: string): SaveLayoutDraft {
  if (!selectedLayoutName) {
    return {
      selectedLayoutName: "",
      name: "",
      notes: "",
      isUpdatingExisting: false,
    };
  }

  const existingLayout = layouts.find((layout) => layout.name === selectedLayoutName);
  return {
    selectedLayoutName,
    name: existingLayout?.name ?? selectedLayoutName,
    notes: existingLayout?.notes ?? "",
    isUpdatingExisting: true,
  };
}
