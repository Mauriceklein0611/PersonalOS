type RoutePlaceholderProps = {
  description: string;
  eyebrow: string;
  title: string;
};

export function RoutePlaceholder({
  description,
  eyebrow,
  title,
}: RoutePlaceholderProps) {
  return (
    <section className="route-page" aria-labelledby="page-title">
      <p className="page-eyebrow">{eyebrow}</p>
      <h1 id="page-title">{title}</h1>
      <p className="page-description">{description}</p>
      <div className="empty-state" role="note">
        <p>Noch keine Einträge</p>
        <span>
          Dieser Bereich ist vorbereitet. Die fachlichen Funktionen folgen in
          einem eigenen Issue.
        </span>
      </div>
    </section>
  );
}
