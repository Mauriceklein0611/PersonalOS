import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Checkbox } from "./Checkbox";
import { Input } from "./Input";
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

  it("toggles the native checkbox with the keyboard", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Heute anzeigen" />);

    const checkbox = screen.getByRole("checkbox", { name: "Heute anzeigen" });
    checkbox.focus();
    await user.keyboard(" ");

    expect(checkbox).toBeChecked();
  });
});
