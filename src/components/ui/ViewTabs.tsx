import { useRef, type KeyboardEvent } from "react";

import { viewTabId } from "./view-tab-id";
import { classNames } from "../../lib/class-names";

export type ViewTabItem<Id extends string = string> = {
  /**
   * Zähler und seine Vorlesefassung in einem Feld. Getrennte Felder ließen
   * eine Zahl ohne Beschriftung zu, und genau die läse ein Screenreader dann
   * als nacktes „3“ hinter dem Namen des Reiters.
   */
  count?: { label: string; value: number };
  /** Stabile Kennung der Ansicht; sie bleibt unverändert. */
  id: Id;
  label: string;
};

export type ViewTabsProps<Id extends string> = {
  activeId: Id;
  className?: string;
  /**
   * Grundlage der Element-IDs. Das Panel verweist mit `aria-labelledby` auf
   * `viewTabId(idPrefix, activeId)` zurück.
   */
  idPrefix: string;
  /** Wofür die Reiter stehen, zum Beispiel „Aufgabenansicht“. */
  label: string;
  onChange: (id: Id) => void;
  /** Die `id` des zugehörigen `tabpanel`. */
  panelId: string;
  tabs: ReadonlyArray<ViewTabItem<Id>>;
};

/**
 * Reiter für die Ansichten einer Domainseite.
 *
 * Die Reihe scrollt nicht seitlich weg, sondern bricht um: Unterhalb von
 * 34 rem stehen höchstens zwei Reiter nebeneinander, darüber alle in einer
 * Zeile. Eine seitlich scrollende Reihe versteckt genau die Ansichten, die
 * hinten stehen — bei 375 px waren das „Diese Woche“, „Fortschritt“ und
 * „Archiv“.
 *
 * Die Tastaturbedienung folgt dem ARIA-Tab-Pattern mit wanderndem
 * `tabindex`: Ein Tabulatorschritt führt in die Reihe, Links und Rechts
 * wechseln darin, Pos1 und Ende springen an die Ränder. Die Auswahl folgt
 * dem Fokus, weil beide Panels bereits geladene lokale Daten zeigen.
 *
 * Hoch und Runter sind bewusst nicht belegt. Im 2×2-Umbruch liegt der
 * nächste Reiter senkrecht zwei Positionen weiter, nicht eine; eine Belegung
 * mit ±1 zeigte in die falsche Richtung, und ±2 hinge an einer Spaltenzahl,
 * die erst das Layout entscheidet.
 */
export function ViewTabs<Id extends string>({
  activeId,
  className,
  idPrefix,
  label,
  onChange,
  panelId,
  tabs,
}: ViewTabsProps<Id>) {
  const tabRefs = useRef(new Map<Id, HTMLButtonElement>());

  const focusTab = (index: number) => {
    const target = tabs[index];
    if (!target) {
      return;
    }

    onChange(target.id);
    tabRefs.current.get(target.id)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((tab) => tab.id === activeId);
    if (current === -1) {
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
        focusTab((current - 1 + tabs.length) % tabs.length);
        break;
      case "ArrowRight":
        focusTab((current + 1) % tabs.length);
        break;
      case "Home":
        focusTab(0);
        break;
      case "End":
        focusTab(tabs.length - 1);
        break;
      default:
        return;
    }

    event.preventDefault();
  };

  return (
    <div
      aria-label={label}
      className={classNames("ui-view-tabs", className)}
      onKeyDown={handleKeyDown}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;

        /*
         * Der Name steht ausdrücklich als `aria-label` und wird nicht aus
         * Beschriftung und Zählerpille zusammengesetzt: Ob zwischen zwei
         * benachbarten Elementen ein Leerzeichen entsteht, entscheidet jede
         * Umsetzung des Namensalgorithmus für sich. Aus „Inbox“ und „3“ wurde
         * so „Inbox3 Aufgaben“. Der Zähler ist eine Aussage, keine Zierde,
         * und darf nicht am Zusammenfügen hängen.
         */
        return (
          <button
            aria-controls={panelId}
            aria-label={
              tab.count ? `${tab.label}: ${tab.count.label}` : undefined
            }
            aria-selected={isActive}
            className="ui-view-tab"
            id={viewTabId(idPrefix, tab.id)}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            ref={(element) => {
              if (element) {
                tabRefs.current.set(tab.id, element);
              } else {
                tabRefs.current.delete(tab.id);
              }
            }}
            role="tab"
            tabIndex={isActive ? 0 : -1}
            type="button"
          >
            <span className="ui-view-tab-label">{tab.label}</span>
            {tab.count ? (
              <span className="ui-view-tab-count">{tab.count.value}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
