import { describe, expect, it } from "vitest";
import { getSaveLayoutDraft } from "../src/save-layout-state";

describe("getSaveLayoutDraft", () => {
  it("fills name and notes when updating an existing layout", () => {
    const draft = getSaveLayoutDraft(
      [
        { name: "Home", notes: "Docked setup" },
        { name: "Work", notes: "Office monitors" },
      ],
      "Home",
    );

    expect(draft).toEqual({
      selectedLayoutName: "Home",
      name: "Home",
      notes: "Docked setup",
      isUpdatingExisting: true,
    });
  });

  it("returns an empty editable draft for new layouts", () => {
    const draft = getSaveLayoutDraft([{ name: "Home", notes: "Docked setup" }], "");

    expect(draft).toEqual({
      selectedLayoutName: "",
      name: "",
      notes: "",
      isUpdatingExisting: false,
    });
  });
});
