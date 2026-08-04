import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isSafeExternalHref } from "./external-link-policy";
import { ExternalLink } from "./ExternalLink";

describe("ExternalLink", () => {
  it("opens HTTPS destinations without opener or referrer access", () => {
    render(
      <ExternalLink href="https://example.com/help">
        Externe Hilfe
      </ExternalLink>,
    );

    const link = screen.getByRole("link", { name: "Externe Hilfe" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("rejects executable, insecure, and credential-bearing destinations", () => {
    expect(isSafeExternalHref("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalHref("http://example.com")).toBe(false);
    expect(isSafeExternalHref("https://user:secret@example.com")).toBe(false);
    expect(isSafeExternalHref("https://example.com")).toBe(true);
  });
});
