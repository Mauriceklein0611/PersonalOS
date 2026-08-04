import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";
import { IconButton } from "./IconButton";

describe("Button", () => {
  it("announces and disables its loading state", () => {
    render(<Button isLoading>Speichern</Button>);

    const button = screen.getByRole("button", { name: "Wird geladen …" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("supports keyboard activation", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Speichern</Button>);

    const button = screen.getByRole("button", { name: "Speichern" });
    button.focus();
    await user.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("IconButton", () => {
  it("requires and exposes a text label", () => {
    render(<IconButton label="Eintrag bearbeiten">✎</IconButton>);

    expect(
      screen.getByRole("button", { name: "Eintrag bearbeiten" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("✎")).toHaveAttribute("aria-hidden", "true");
  });
});
