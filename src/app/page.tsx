"use client";

import { useState } from "react";
import type { Priority } from "../../lib/types/lead";
import {
  Button,
  Card,
  Dialog,
  Skeleton,
  VisuallyHidden,
} from "@/components/ui/primitives";
import {
  ConfidenceIndicator,
  FlagChip,
  MissingInfoList,
  NextActionCallout,
  PriorityBadge,
  ReasonList,
  ScoreMark,
  SourceTag,
} from "@/components/lead/LeadSignals";
import { useLeadDesk, type DeskLead } from "@/hooks/useLeadDesk";

type PriorityFilter = "ALL" | Priority;
type SortOrder = "score" | "recent";

const priorityFilters: { value: PriorityFilter; label: string }[] = [
  { value: "ALL", label: "All leads" },
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function receivedLabel(receivedAt: string): string {
  const ageMinutes = Math.round((Date.parse(receivedAt) - Date.now()) / 60_000);
  if (Math.abs(ageMinutes) < 60)
    return relativeTime.format(ageMinutes, "minute");
  const ageHours = Math.round(ageMinutes / 60);
  if (Math.abs(ageHours) < 24) return relativeTime.format(ageHours, "hour");
  return relativeTime.format(Math.round(ageHours / 24), "day");
}

function propertyLabel(lead: DeskLead["lead"]): string {
  const location = [lead.property.address, lead.property.city]
    .filter(Boolean)
    .join(", ");
  return (
    location || lead.property.propertyType || "Property details not provided"
  );
}

function currencyRange(lead: DeskLead["lead"]): string {
  const format = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: lead.budget.currency,
      maximumFractionDigits: 0,
    }).format(value);
  const { min, max } = lead.budget;
  if (min !== undefined && max !== undefined)
    return `${format(min)} – ${format(max)}`;
  if (max !== undefined) return `Up to ${format(max)}`;
  if (min !== undefined) return `From ${format(min)}`;
  return "Budget not provided";
}

function LeadRow({
  lead,
  rank,
  onSelect,
}: {
  lead: DeskLead;
  rank: number;
  onSelect: () => void;
}) {
  const name = lead.lead.name;
  return (
    <li className="lead-row-item">
      <button className="lead-row" type="button" onClick={onSelect}>
        <span className="row-rank" aria-hidden="true">
          {String(rank).padStart(2, "0")}
        </span>
        <span className="row-main">
          <span className="row-name-line">
            <span className="row-name">{name}</span>
            <PriorityBadge priority={lead.assessment.priority} />
          </span>
          <span className="row-property" title={propertyLabel(lead.lead)}>
            {propertyLabel(lead.lead)}
          </span>
          <span className="row-flags">
            {lead.flags.map((flag) => (
              <FlagChip key={flag} flag={flag} />
            ))}
          </span>
        </span>
        <span className="row-action" title={lead.assessment.recommendedAction}>
          {lead.assessment.recommendedAction}
        </span>
        <span className="row-source">
          <SourceTag source={lead.lead.source} mode={lead.assessmentSource} />
        </span>
        <span className="row-score">
          <ScoreMark score={lead.assessment.score} />
        </span>
        <span className="row-time">
          <time dateTime={lead.lead.receivedAt}>
            {receivedLabel(lead.lead.receivedAt)}
          </time>
        </span>
        <span className="row-chevron" aria-hidden="true">
          ↗
        </span>
      </button>
    </li>
  );
}

function LeadDetail({ lead }: { lead: DeskLead }) {
  return (
    <div className="detail-content">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">LEAD DETAILS</p>
          <Dialog.Title className="detail-title">
            {lead.lead.name}
          </Dialog.Title>
          <Dialog.Description className="detail-property">
            {propertyLabel(lead.lead)}
          </Dialog.Description>
        </div>
        <div className="detail-score">
          <PriorityBadge priority={lead.assessment.priority} />
          <ScoreMark score={lead.assessment.score} />
        </div>
      </div>
      <NextActionCallout action={lead.assessment.recommendedAction} />
      <section className="detail-section">
        <h3>Why this lead</h3>
        <ReasonList reasons={lead.assessment.reasons} />
      </section>
      <div className="detail-columns">
        <section className="detail-section">
          <h3>Contact &amp; timing</h3>
          <dl className="detail-facts">
            <div>
              <dt>Email</dt>
              <dd>{lead.lead.email ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{lead.lead.phone ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Budget</dt>
              <dd>{currencyRange(lead.lead)}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>
                <time dateTime={lead.lead.receivedAt}>
                  {receivedLabel(lead.lead.receivedAt)}
                </time>
              </dd>
            </div>
          </dl>
        </section>
        <section className="detail-section">
          <h3>Still to confirm</h3>
          <MissingInfoList items={lead.assessment.missingInformation} />
          <ConfidenceIndicator confidence={lead.assessment.confidence} />
        </section>
      </div>
      <section className="detail-section message-section">
        <h3>Original message</h3>
        <p className="lead-message">
          {lead.lead.message || "No message provided."}
        </p>
      </section>
      <div className="detail-source">
        <SourceTag source={lead.lead.source} mode={lead.assessmentSource} />
      </div>
    </div>
  );
}

function LeadDeskSkeleton() {
  return (
    <main className="desk-main" aria-label="Loading lead desk">
      <div className="desk-heading">
        <Skeleton className="skeleton-label" />
        <Skeleton className="skeleton-heading" />
        <Skeleton className="skeleton-copy" />
      </div>
      <div className="desk-layout">
        <Card className="featured-card">
          <Skeleton className="skeleton-label" />
          <Skeleton className="skeleton-heading" />
          <Skeleton className="skeleton-copy" />
          <Skeleton className="skeleton-copy" />
        </Card>
        <section className="queue-panel" aria-hidden="true">
          <Skeleton className="skeleton-label" />
          <Skeleton className="skeleton-row" />
          <Skeleton className="skeleton-row" />
          <Skeleton className="skeleton-row" />
        </section>
      </div>
    </main>
  );
}

export default function Home() {
  const { state, reload } = useLeadDesk();
  const [priority, setPriority] = useState<PriorityFilter>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("score");
  const [selected, setSelected] = useState<DeskLead | null>(null);

  if (state.status === "loading") return <LeadDeskSkeleton />;

  if (state.status === "error") {
    return (
      <main className="desk-main error-main">
        <p className="eyebrow">LEAD DESK</p>
        <h1>We couldn’t load the queue.</h1>
        <p className="error-message" role="alert">
          {state.message}
        </p>
        <Button
          variant="primary"
          onClick={() => {
            void reload();
          }}
        >
          Retry
        </Button>
      </main>
    );
  }

  const filteredLeads = state.ranked
    .filter(
      (lead) => priority === "ALL" || lead.assessment.priority === priority,
    )
    .sort((left, right) =>
      sortOrder === "score"
        ? right.assessment.score - left.assessment.score
        : Date.parse(right.lead.receivedAt) - Date.parse(left.lead.receivedAt),
    );
  const featured = filteredLeads[0];
  const queue = filteredLeads.slice(1);

  return (
    <main className="desk-main">
      <section className="desk-heading" aria-labelledby="desk-title">
        <p className="eyebrow">
          YOUR LEAD DESK <span className="eyebrow-divider">/</span>{" "}
          {new Intl.DateTimeFormat("en", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
            .format(new Date())
            .toUpperCase()}
        </p>
        <h1 id="desk-title">Who needs you next?</h1>
        <div className="desk-subhead">
          <p>
            One clear next step, ranked by the strength of each conversation.
          </p>
          <span className="desk-count">
            <strong>{state.ranked.length}</strong> ready{" "}
            <span aria-hidden="true">·</span> {state.rejectedCount} held for
            review
          </span>
        </div>
      </section>

      <div className="desk-layout">
        {featured ? (
          <Card className="featured-card">
            <div className="featured-topline">
              <span className="eyebrow">
                <span className="featured-mark" aria-hidden="true" /> NEXT TO
                CONTACT
              </span>
              <span className="featured-rank">
                01{" "}
                <span>
                  / {filteredLeads.length.toString().padStart(2, "0")}
                </span>
              </span>
            </div>
            <button
              className="featured-identity"
              type="button"
              onClick={() => setSelected(featured)}
            >
              <span className="featured-name">
                {featured.lead.name}
              </span>
              <span className="featured-property">
                {propertyLabel(featured.lead)}
              </span>
            </button>
            <div className="featured-meta">
              <PriorityBadge priority={featured.assessment.priority} />
              <ScoreMark score={featured.assessment.score} />
              <ConfidenceIndicator
                confidence={featured.assessment.confidence}
              />
            </div>
            <div className="featured-reasons">
              <span className="eyebrow">WHY NOW</span>
              <ReasonList reasons={featured.assessment.reasons} />
            </div>
            <NextActionCallout action={featured.assessment.recommendedAction} />
            <div className="featured-bottom">
              <div className="row-flags">
                {featured.flags.map((flag) => (
                  <FlagChip key={flag} flag={flag} />
                ))}
              </div>
              <div className="featured-source">
                <SourceTag
                  source={featured.lead.source}
                  mode={featured.assessmentSource}
                />
                <time dateTime={featured.lead.receivedAt}>
                  {receivedLabel(featured.lead.receivedAt)}
                </time>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="featured-card empty-feature">
            <p className="eyebrow">NO MATCHING LEADS</p>
            <h2>Try another priority.</h2>
            <p>Your full queue is still here when you clear the filter.</p>
          </Card>
        )}

        <section className="queue-panel" aria-labelledby="queue-title">
          <div className="queue-heading">
            <div>
              <p className="eyebrow">IN THE QUEUE</p>
              <h2 id="queue-title">Ranked conversations</h2>
            </div>
            <label className="sort-control">
              <VisuallyHidden>Sort leads</VisuallyHidden>
              <select
                value={sortOrder}
                onChange={(event) =>
                  setSortOrder(event.target.value as SortOrder)
                }
              >
                <option value="score">Score: highest</option>
                <option value="recent">Received: newest</option>
              </select>
            </label>
          </div>
          <div
            className="filter-list"
            role="group"
            aria-label="Filter leads by priority"
          >
            {priorityFilters.map((filter) => (
              <button
                className={`filter-chip ${priority === filter.value ? "filter-chip--active" : ""}`}
                type="button"
                key={filter.value}
                aria-pressed={priority === filter.value}
                onClick={() => setPriority(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <ol className="lead-list" aria-label="Ranked leads">
            {queue.map((lead, index) => (
              <LeadRow
                key={lead.lead.id}
                lead={lead}
                rank={index + 2}
                onSelect={() => setSelected(lead)}
              />
            ))}
          </ol>
          {queue.length === 0 && featured ? (
            <p className="queue-empty">No other leads in this view.</p>
          ) : null}
        </section>
      </div>

      <Dialog.Root
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          {selected ? (
            <Dialog.Content className="dialog-content">
              <Dialog.Close asChild>
                <Button
                  className="dialog-close"
                  variant="quiet"
                  aria-label="Close lead details"
                >
                  ×
                </Button>
              </Dialog.Close>
              <LeadDetail lead={selected} />
            </Dialog.Content>
          ) : null}
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
