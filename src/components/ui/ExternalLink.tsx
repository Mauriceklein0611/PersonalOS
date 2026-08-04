import type { AnchorHTMLAttributes } from "react";

import { isSafeExternalHref } from "./external-link-policy";

export type ExternalLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "referrerPolicy" | "rel" | "target"
> & {
  href: string;
};

export function ExternalLink({ href, ...anchorProps }: ExternalLinkProps) {
  if (!isSafeExternalHref(href)) {
    throw new Error(
      "External links must use HTTPS without embedded credentials.",
    );
  }

  return (
    <a
      {...anchorProps}
      href={href}
      referrerPolicy="no-referrer"
      rel="noopener noreferrer"
      target="_blank"
    />
  );
}
