import { useState, type ReactNode } from "react";

import {
  Button,
  Card,
  Chart,
  Checkbox,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  MetricTile,
  ProgressBar,
  ProgressRing,
  RankedBarList,
  Select,
  Skeleton,
  Textarea,
  Toast,
  TrackerCell,
  type TrackerCellState,
} from "../../components/ui";
import "./component-preview.css";

/** Ausschließlich erfundene Beispieldaten für die lokale Referenz. */
const trackerDays = [
  "Mo, 3. August",
  "Di, 4. August",
  "Mi, 5. August",
  "Do, 6. August",
  "Fr, 7. August",
  "Sa, 8. August",
  "So, 9. August",
];

const chartDays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const trackerRows: Array<{
  label: string;
  states: TrackerCellState[];
}> = [
  {
    label: "Beispielgewohnheit A",
    states: ["done", "done", "partial", "done", "open", "none", "none"],
  },
  {
    label: "Beispielgewohnheit B",
    states: ["skipped", "done", "done", "open", "open", "none", "none"],
  },
];

export function Component() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showToast, setShowToast] = useState(true);

  return (
    <section className="component-preview" aria-labelledby="page-title">
      <header className="component-preview-header">
        <p className="page-eyebrow">Lokale UI-Referenz</p>
        <h1 id="page-title">Komponenten</h1>
        <p className="page-description">
          Domänenneutrale Bausteine mit deutschen Beschriftungen, klaren
          Zuständen und stabilen Tastaturpfaden.
        </p>
      </header>

      <PreviewSection title="Buttons und Zustände">
        <PreviewItem label="Normal">
          <Button>Speichern</Button>
        </PreviewItem>
        <PreviewItem label="Hover (simuliert)" stateClass="preview-force-hover">
          <Button>Speichern</Button>
        </PreviewItem>
        <PreviewItem label="Fokus (simuliert)" stateClass="preview-force-focus">
          <Button>Speichern</Button>
        </PreviewItem>
        <PreviewItem label="Sekundär">
          <Button variant="secondary">Abbrechen</Button>
        </PreviewItem>
        <PreviewItem label="Destruktiv">
          <Button variant="danger">Löschen</Button>
        </PreviewItem>
        <PreviewItem label="Disabled">
          <Button disabled>Speichern</Button>
        </PreviewItem>
        <PreviewItem label="Loading">
          <Button isLoading>Speichern</Button>
        </PreviewItem>
        <PreviewItem label="Icon Button">
          <IconButton label="Eintrag bearbeiten">✎</IconButton>
        </PreviewItem>
      </PreviewSection>

      <PreviewSection title="Formulare">
        <Input
          hint="Ein kurzer, eindeutiger Name."
          label="Aufgabentitel"
          placeholder="Zum Beispiel: Wochenplanung"
        />
        <Input
          defaultValue=""
          error="Gib einen Titel mit mindestens einem Zeichen ein."
          label="Fehlerzustand"
          required
        />
        <Textarea
          hint="Optional, maximal 2.000 Zeichen."
          label="Notiz"
          placeholder="Zusätzlicher Kontext"
        />
        <Select defaultValue="normal" label="Priorität">
          <option value="low">Niedrig</option>
          <option value="normal">Normal</option>
          <option value="high">Hoch</option>
        </Select>
        <Checkbox
          hint="Du kannst dies später jederzeit ändern."
          label="In der Tagesübersicht anzeigen"
        />
        <Input disabled label="Disabled" value="Nicht bearbeitbar" readOnly />
      </PreviewSection>

      <PreviewSection title="Container und Rückmeldung">
        <Card
          description="Eine ruhige Gruppierung für zusammengehörende Inhalte."
          footer={<span>Zuletzt lokal aktualisiert</span>}
          title="Beispielkarte"
        >
          <p>
            Cards treffen keine fachlichen Annahmen und speichern keine Daten.
          </p>
        </Card>

        {showToast ? (
          <Toast
            action={{ label: "Rückgängig", onClick: () => setShowToast(false) }}
            message="Die Änderung wurde nur auf diesem Gerät gespeichert."
            onDismiss={() => setShowToast(false)}
            title="Gespeichert"
            tone="success"
            visual="✓"
          />
        ) : (
          <Button onClick={() => setShowToast(true)} variant="secondary">
            Toast erneut zeigen
          </Button>
        )}

        <Card title="Skeleton">
          <Skeleton lines={3} width="65%" />
        </Card>

        <EmptyState
          action={<Button variant="secondary">Ersten Eintrag anlegen</Button>}
          description="Leere Zustände erklären den nächsten sinnvollen Schritt, ohne Druck aufzubauen."
          title="Noch keine Einträge"
          visual="＋"
        />
      </PreviewSection>

      <section className="preview-section">
        <h2>Kennzahl-Tiles</h2>
        <div className="ui-dashboard-grid">
          <MetricTile
            context="Diese Woche, lokal gezählt"
            label="Erledigt"
            value="249"
          />
          <MetricTile context="Ohne Zielvorgabe" label="Offen" value="107" />
          <MetricTile
            context="Kein Eintrag in diesem Zeitraum"
            label="Leerzustand"
            value={null}
          />
          <MetricTile
            error="Die Kennzahl konnte nicht berechnet werden."
            label="Fehlerzustand"
            value="0"
          />
        </div>
        <div className="preview-stack preview-canvas">
          <MetricTile
            context="Ruhige Hero-Fläche mit genau einer Aktion"
            label="Guten Morgen"
            tone="hero"
            value="Mittwoch, 5. August"
          />
        </div>
      </section>

      <PreviewSection title="Ring- und Balkenfortschritt" tone="dashboard">
        <PreviewItem label="Ring mit Glow (einmal je Ansicht)">
          <ProgressRing
            caption="12 von 17 Schritten"
            glow
            label="Tagesfortschritt"
            value={0.71}
          />
        </PreviewItem>
        <PreviewItem label="Ring normal">
          <ProgressRing
            caption="12 von 17 Schritten"
            label="Tagesfortschritt"
            value={0.71}
          />
        </PreviewItem>
        <PreviewItem label="Ring ohne Datenbasis">
          <ProgressRing
            caption="Noch kein Eintrag für heute"
            label="Tagesfortschritt"
            value={null}
          />
        </PreviewItem>
        <PreviewItem label="Ring mit eigenem Wertetext">
          <ProgressRing
            label="Wochenziel"
            size="sm"
            tone={5}
            value={0.6}
            valueText="3 von 5"
          />
        </PreviewItem>
        <PreviewItem label="Ring im Fehlerzustand">
          <ProgressRing
            error="Der Fortschritt ist gerade nicht lesbar."
            label="Tagesfortschritt"
            value={0.4}
          />
        </PreviewItem>
        <PreviewItem label="Balken normal">
          <ProgressBar
            caption="Grundlage: geplante Einheiten dieser Woche"
            label="Wochenquote"
            value={0.42}
          />
        </PreviewItem>
        <PreviewItem label="Balken leer">
          <ProgressBar label="Wochenquote" value={null} />
        </PreviewItem>
        <PreviewItem label="Balken im Fehlerzustand">
          <ProgressBar
            error="Die Quote konnte nicht gelesen werden."
            label="Wochenquote"
            value={0.42}
          />
        </PreviewItem>
      </PreviewSection>

      <PreviewSection title="Ranglisten-Balken" tone="dashboard">
        <PreviewItem label="Normal">
          <RankedBarList
            caption="Orientierung, keine Rangordnung."
            items={[
              { id: "a", label: "Beispiel Lesen", value: 21 },
              { id: "b", label: "Beispiel Sport", value: 18 },
              { id: "c", label: "Beispiel Wasser", value: 15 },
              { id: "d", label: "Beispiel Planung", value: 12 },
              { id: "e", label: "Beispiel Dehnen", value: 9 },
            ]}
            label="Aktive Serien"
            tone={2}
          />
        </PreviewItem>
        <PreviewItem label="Leerzustand">
          <RankedBarList
            emptyMessage="Noch keine Serien erfasst."
            items={[]}
            label="Aktive Serien"
          />
        </PreviewItem>
        <PreviewItem label="Fehlerzustand">
          <RankedBarList
            error="Die Liste konnte nicht geladen werden."
            items={[{ id: "a", label: "Beispiel Lesen", value: 21 }]}
            label="Aktive Serien"
          />
        </PreviewItem>
      </PreviewSection>

      <section className="preview-section">
        <h2>Tracker-Raster</h2>
        <div className="preview-stack preview-canvas">
          <TrackerGrid label="Wochenraster, Normalzustand" />
          <p className="preview-note">
            Fokus (simuliert): Das Raster ist per Tastatur erreichbar und
            scrollt in seinem eigenen Container.
          </p>
          <div className="preview-force-focus">
            <TrackerGrid label="Wochenraster, simulierter Fokus" />
          </div>
          <ul className="preview-legend">
            {(
              [
                ["done", "Erledigt"],
                ["partial", "Teilweise"],
                ["skipped", "Übersprungen"],
                ["open", "Offen"],
                ["none", "Keine Angabe"],
              ] as Array<[TrackerCellState, string]>
            ).map(([state, label]) => (
              <li key={state}>
                <TrackerCell dayLabel="Beispieltag" state={state} />
                {label}
              </li>
            ))}
            <li>
              <TrackerCell dayLabel="Beispieltag" state="done" tone={3} />
              Erledigt mit Wochenfarbe
            </li>
          </ul>
        </div>
      </section>

      <PreviewSection title="Diagramme" tone="dashboard">
        <PreviewItem label="Linie mit Verlaufsfüllung">
          <Chart
            categories={chartDays}
            period="1. bis 7. August"
            series={[
              {
                id: "done",
                label: "Erledigte Aufgaben",
                tone: 1,
                values: [3, 5, 4, 8, 6, 9, 11],
              },
              {
                id: "planned",
                label: "Geplante Aufgaben",
                tone: 2,
                values: [6, 6, 7, 9, 8, 10, 12],
              },
            ]}
            source="Grundlage: erfundene Beispieldaten dieser Vorschau"
            title="Wochenverlauf"
          />
        </PreviewItem>
        <PreviewItem label="Balken">
          <Chart
            categories={chartDays}
            period="1. bis 7. August"
            series={[
              {
                id: "done",
                label: "Erledigte Aufgaben",
                tone: 3,
                values: [3, 5, 4, 8, 6, 9, 11],
              },
            ]}
            source="Grundlage: erfundene Beispieldaten dieser Vorschau"
            title="Tagesvergleich"
            type="bar"
          />
        </PreviewItem>
        <PreviewItem label="Leerzustand">
          <Chart
            categories={chartDays}
            emptyMessage="Für diesen Zeitraum liegen keine Einträge vor."
            period="1. bis 7. August"
            series={[]}
            source="Grundlage: erfundene Beispieldaten dieser Vorschau"
            title="Wochenverlauf"
          />
        </PreviewItem>
        <PreviewItem label="Fehlerzustand">
          <Chart
            categories={chartDays}
            error="Der Verlauf konnte nicht gezeichnet werden."
            period="1. bis 7. August"
            series={[]}
            source="Grundlage: erfundene Beispieldaten dieser Vorschau"
            title="Wochenverlauf"
          />
        </PreviewItem>
      </PreviewSection>

      {/*
        Ohne Blur muss dieselbe Ansicht vollwertig bleiben. Die Vorschau zeigt
        den Zustand ausdrücklich, damit er nicht nur in der Theorie existiert.
      */}
      <section className="preview-section">
        <h2>Fallback ohne Blur</h2>
        <p className="preview-note">
          So sehen die Bausteine aus, wenn der Browser `backdrop-filter` nicht
          unterstützt oder weniger Transparenz gewünscht ist.
        </p>
        <div className="preview-stack preview-canvas preview-force-opaque">
          <div className="ui-dashboard-grid">
            <MetricTile
              context="Diese Woche, lokal gezählt"
              label="Erledigt"
              value="249"
            />
            <MetricTile context="Ohne Zielvorgabe" label="Offen" value="107" />
          </div>
          <Card
            description="Dieselbe Karte mit deckender Fläche."
            title="Beispielkarte"
          >
            <p>Der Nebel im Hintergrund bleibt erhalten.</p>
          </Card>
        </div>
      </section>

      <PreviewSection title="Dialog">
        <Button onClick={() => setIsDialogOpen(true)}>Dialog öffnen</Button>
        <Dialog
          actions={
            <>
              <Button
                onClick={() => setIsDialogOpen(false)}
                variant="secondary"
              >
                Abbrechen
              </Button>
              <Button onClick={() => setIsDialogOpen(false)}>Bestätigen</Button>
            </>
          }
          description="Der Dialog nutzt native Fokus- und Escape-Unterstützung."
          onClose={() => setIsDialogOpen(false)}
          open={isDialogOpen}
          title="Änderung bestätigen"
        >
          <p>Diese Vorschau verändert keine gespeicherten Daten.</p>
        </Dialog>
      </PreviewSection>
    </section>
  );
}

function TrackerGrid({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="ui-tracker-scroller"
      role="group"
      tabIndex={0}
    >
      <table className="ui-tracker-grid">
        <caption className="visually-hidden">
          {label}: Zeilen sind Gewohnheiten, Spalten sind Tage der Woche 32.
        </caption>
        <thead>
          <tr>
            <th scope="col">Gewohnheit</th>
            {trackerDays.map((day) => (
              <th key={day} scope="col">
                <span aria-hidden="true">{day.slice(0, 2)}</span>
                <span className="visually-hidden">{day}</span>
              </th>
            ))}
            <th scope="col">Quote</th>
          </tr>
        </thead>
        <tbody>
          {trackerRows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.states.map((state, index) => (
                <td key={trackerDays[index]}>
                  <TrackerCell dayLabel={trackerDays[index]!} state={state} />
                </td>
              ))}
              <td className="preview-tracker-rate">
                <ProgressBar
                  label="Quote"
                  value={toRate(row.states)}
                  valueText={`${countDone(row.states)} von ${row.states.length}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function countDone(states: TrackerCellState[]): number {
  return states.filter((state) => state === "done").length;
}

function toRate(states: TrackerCellState[]): number {
  return countDone(states) / states.length;
}

function PreviewSection({
  children,
  title,
  tone = "default",
}: {
  children: ReactNode;
  title: string;
  tone?: "default" | "dashboard";
}) {
  return (
    <section className="preview-section">
      <h2>{title}</h2>
      <div
        className={`preview-grid${tone === "dashboard" ? " preview-grid-dashboard" : ""}`}
      >
        {children}
      </div>
    </section>
  );
}

function PreviewItem({
  children,
  label,
  stateClass,
}: {
  children: ReactNode;
  label: string;
  stateClass?: string;
}) {
  return (
    <div className={`preview-item${stateClass ? ` ${stateClass}` : ""}`}>
      <span>{label}</span>
      {children}
    </div>
  );
}
