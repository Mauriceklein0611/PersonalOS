import type { ReactNode } from "react";

import type { NavigationIconName } from "./navigation-items";

/**
 * Inline-SVG statt einer Icon-Bibliothek: fünf Symbole sind wenige hundert
 * Byte und brauchen keine Laufzeitabhängigkeit (`AGENTS.md` §4).
 *
 * Das Icon ist immer Zusatz zur Beschriftung, niemals ihr Ersatz. Es ist
 * deshalb `aria-hidden` und trägt keinen zugänglichen Namen.
 */
const iconPaths: Record<NavigationIconName | "more", ReactNode> = {
  finance: (
    <>
      <rect height="13" rx="2.5" width="17" x="3.5" y="6" />
      <path d="M3.5 10.5h17" />
      <circle cx="16.5" cy="15" fill="currentColor" r="1.1" stroke="none" />
    </>
  ),
  goals: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" fill="currentColor" r="0.9" stroke="none" />
    </>
  ),
  habits: (
    <>
      <path d="M4.75 12a7.25 7.25 0 0 1 12.4-5.1l2.1 2.1" />
      <path d="M19.25 4.75V9h-4.25" />
      <path d="M19.25 12a7.25 7.25 0 0 1-12.4 5.1l-2.1-2.1" />
      <path d="M4.75 19.25V15H9" />
    </>
  ),
  insights: (
    <>
      <path d="M4 19.5h16" />
      <path d="M7.5 19.5v-5.5M12 19.5v-10M16.5 19.5v-3.5" />
    </>
  ),
  journal: (
    <>
      <rect height="17" rx="2" width="14" x="5" y="3.5" />
      <path d="M9 3.5v17" />
      <path d="M12 8.5h3.5M12 12.5h3.5" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" fill="currentColor" r="1.5" stroke="none" />
      <circle cx="12" cy="12" fill="currentColor" r="1.5" stroke="none" />
      <circle cx="18" cy="12" fill="currentColor" r="1.5" stroke="none" />
    </>
  ),
  settings: (
    <>
      <path d="M4 8.5h8M17 8.5h3M4 15.5h3M12 15.5h8" />
      <circle cx="14.5" cy="8.5" r="2.2" />
      <circle cx="9.5" cy="15.5" r="2.2" />
    </>
  ),
  tasks: (
    <>
      <path d="M4 7h9M4 12h9M4 17h6" />
      <path d="M15 16l2 2 4-4.5" />
    </>
  ),
  today: (
    <>
      <rect height="16" rx="2.5" width="17" x="3.5" y="4.5" />
      <path d="M8 2.75v3.5M16 2.75v3.5M3.5 9.75h17" />
      <circle cx="12" cy="14.75" fill="currentColor" r="1.5" stroke="none" />
    </>
  ),
};

export type NavigationIconProps = {
  name: NavigationIconName | "more";
};

export function NavigationIcon({ name }: NavigationIconProps) {
  return (
    <svg
      aria-hidden="true"
      className="navigation-icon"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      viewBox="0 0 24 24"
    >
      {iconPaths[name]}
    </svg>
  );
}
