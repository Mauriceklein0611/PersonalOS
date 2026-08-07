import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "./Checkbox";
import { Input } from "./Input";
import { SearchField } from "./SearchField";
import { Select } from "./Select";
import { Textarea } from "./Textarea";

describe("form controls", () => {
  it("connects labels, hints and errors to the input", () => {
    render(
      <Input
        error="Gib einen Titel ein."
        hint="Mindestens ein Zeichen."
        label="Titel"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Titel" });
    const describedBy = input.getAttribute("aria-describedby") ?? "";

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(describedBy).toContain("-hint");
    expect(describedBy).toContain("-error");
    expect(screen.getByText("Gib einen Titel ein.")).toBeInTheDocument();
  });

  it("keeps textarea and select correctly labelled", () => {
    render(
      <>
        <Textarea label="Notiz" />
        <Select label="Priorität" defaultValue="normal">
          <option value="normal">Normal</option>
        </Select>
      </>,
    );

    expect(screen.getByRole("textbox", { name: "Notiz" })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Priorität" }),
    ).toBeInTheDocument();
  });

  it("labels the search field and announces the match count", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchField
        label="Aufgaben durchsuchen"
        onChange={onChange}
        resultLabel="1 von 12 Aufgaben"
        value=""
      />,
    );

    const search = screen.getByRole("searchbox", {
      name: "Aufgaben durchsuchen",
    });
    search.focus();
    await user.keyboard("Miete");

    expect(search).toHaveFocus();
    expect(onChange).toHaveBeenCalledWith("M");
    // Der Suchbegriff darf nicht in der Formularhistorie des Browsers landen.
    expect(search).toHaveAttribute("autocomplete", "off");
    expect(screen.getByRole("status")).toHaveTextContent("1 von 12 Aufgaben");
  });

  it("toggles the native checkbox with the keyboard", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Heute anzeigen" />);

    const checkbox = screen.getByRole("checkbox", { name: "Heute anzeigen" });
    checkbox.focus();
    await user.keyboard(" ");

    expect(checkbox).toBeChecked();
  });
});
