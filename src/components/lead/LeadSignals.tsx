import type { Priority } from "../../../lib/types/lead";
import { Badge, Tooltip } from "../ui/primitives";

const priorityLabels: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`priority-badge priority-badge--${priority.toLowerCase()}`}
      aria-label={`Priority: ${priorityLabels[priority]}`}
    >
      <span className="priority-mark" aria-hidden="true" />
      <span>{priorityLabels[priority]}</span>
    </span>
  );
}

export function ScoreMark({ score }: { score: number }) {
  return (
    <span className="score-mark" aria-label={`Lead score ${score} out of 100`}>
      <span>{score}</span>
      <span className="score-denominator" aria-hidden="true">
        /100
      </span>
    </span>
  );
}

const confidenceDefinitions = {
  LOW: "Limited evidence is available. Confirm key details before investing time.",
  MEDIUM:
    "Some useful signals are present, but important details remain unconfirmed.",
  HIGH: "Several specific, consistent signals support this assessment.",
} as const;

export function ConfidenceIndicator({
  confidence,
}: {
  confidence: keyof typeof confidenceDefinitions;
}) {
  const label = confidence.charAt(0) + confidence.slice(1).toLowerCase();
  return (
    <span className="confidence-indicator">
      <span
        className={`confidence-dot confidence-dot--${confidence.toLowerCase()}`}
        aria-hidden="true"
      />
      <span>{label} confidence</span>
      <Tooltip content={confidenceDefinitions[confidence]}>
        <button
          className="confidence-help"
          type="button"
          aria-label={`What ${label.toLowerCase()} confidence means`}
        >
          <span aria-hidden="true">?</span>
        </button>
      </Tooltip>
    </span>
  );
}

export function SourceTag({
  source,
  mode,
}: {
  source: string;
  mode?: "agent" | "fallback";
}) {
  return (
    <span className="source-tag">
      <span className="source-mark" aria-hidden="true" />
      <span>{source}</span>
      {mode === "fallback" ? (
        <span className="source-mode">Fallback</span>
      ) : null}
    </span>
  );
}

const flagLabels: Record<string, string> = {
  DUPLICATE: "Possible duplicate",
  CONFLICT: "Conflicting details",
  STALE: "Stale",
  REENGAGED: "Re-engaged",
};

export function FlagChip({ flag }: { flag: string }) {
  const kind = flag.split(":", 1)[0] ?? "";
  const label = flagLabels[kind];
  if (!label) return null;
  return (
    <Badge
      className={`flag-chip flag-chip--${kind.toLowerCase()}`}
      title={flag}
    >
      {label}
    </Badge>
  );
}

export function ReasonList({ reasons }: { reasons: string[] }) {
  return (
    <ul className="reason-list">
      {reasons.map((reason, index) => (
        <li key={`${index}-${reason}`}>{reason}</li>
      ))}
    </ul>
  );
}

export function NextActionCallout({ action }: { action: string }) {
  return (
    <div className="next-action">
      <span className="eyebrow">NEXT ACTION</span>
      <p>{action}</p>
    </div>
  );
}

export function MissingInfoList({ items }: { items: string[] }) {
  if (items.length === 0)
    return <p className="quiet-copy">No key details missing.</p>;
  return (
    <ul className="missing-info-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
