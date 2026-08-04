import type { CSSProperties } from "react";

export type SkeletonProps = {
  height?: CSSProperties["height"];
  label?: string;
  lines?: number;
  width?: CSSProperties["width"];
};

export function Skeleton({
  height,
  label = "Inhalt wird geladen",
  lines = 1,
  width = "100%",
}: SkeletonProps) {
  return (
    <div className="ui-skeleton-group" role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, index) => (
        <span
          aria-hidden="true"
          className="ui-skeleton"
          key={index}
          style={{ height, width: index === lines - 1 ? width : "100%" }}
        />
      ))}
    </div>
  );
}
