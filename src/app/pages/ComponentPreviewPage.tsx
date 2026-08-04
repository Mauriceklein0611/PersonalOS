import { useState, type ReactNode } from "react";

import {
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  Select,
  Skeleton,
  Textarea,
  Toast,
} from "../../components/ui";
import "./component-preview.css";

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

function PreviewSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="preview-section">
      <h2>{title}</h2>
      <div className="preview-grid">{children}</div>
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
