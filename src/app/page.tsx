"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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

function subscribeToLeadSelection(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener("lead-selection-change", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("lead-selection-change", onChange);
  };
}

function getSelectedLeadFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("lead");
}

function getServerSelectedLead(): null {
  return null;
}

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

function timelineLabel(lead: DeskLead["lead"]): string {
  const urgency = lead.timeline.urgency?.replaceAll("_", " ").toLowerCase();
  const label = urgency
    ? urgency.charAt(0).toUpperCase() + urgency.slice(1)
    : undefined;
  return label ?? lead.timeline.targetMoveDate ?? "Not provided";
}

function helpfulQuestion(item: string): string {
  if (item.includes("?")) return item;
  return `Could you confirm ${item.charAt(0).toLowerCase()}${item.slice(1)}?`;
}

function flagExplanation(flag: string): { title: string; detail: string } | null {
  const kind = flag.split(":", 1)[0] ?? "";
  switch (kind) {
    case "DUPLICATE":
      return {
        title: "Possible duplicate",
        detail:
          "This may be another record for the same person. Compare the contact details and keep the most complete record.",
      };
    case "CONFLICT":
      return {
        title: "Details to reconcile",
        detail:
          "Two details may not agree. Confirm the information with the lead before relying on either value.",
      };
    case "STALE":
      return {
        title: "Older inquiry",
        detail:
          "This inquiry has been waiting longer than the usual response window. Check whether the person is still looking.",
      };
    case "REENGAGED":
      return {
        title: "New activity",
        detail:
          "Recent activity followed a quieter period. Use the new activity as a natural reason to follow up.",
      };
    default:
      return null;
  }
}

function LeadDetail({
  lead,
  onNavigate,
  isHandled,
  onToggleHandled,
}: {
  lead: DeskLead;
  onNavigate: (direction: -1 | 1) => void;
  isHandled: boolean;
  onToggleHandled: () => void;
}) {
  const [copyFeedback, setCopyFeedback] = useState("");
  const contact = [lead.lead.email, lead.lead.phone].filter(Boolean).join(" · ");
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`${label} copied.`);
    } catch {
      setCopyFeedback("Copy is unavailable in this browser. Select the text to copy it.");
    }
  };

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
          <div className="detail-meta" aria-label="Assessment">
            <PriorityBadge priority={lead.assessment.priority} />
            <ScoreMark score={lead.assessment.score} />
            <ConfidenceIndicator confidence={lead.assessment.confidence} />
          </div>
        </div>
      </div>
      <section className="detail-action">
        <NextActionCallout action={lead.assessment.recommendedAction} />
        <Button
          size="small"
          onClick={() => void copy(lead.assessment.recommendedAction, "Next action")}
        >
          Copy next action
        </Button>
      </section>
      <section className="detail-section">
        <h3>Why</h3>
        <ReasonList reasons={lead.assessment.reasons} />
      </section>
      <div className="detail-columns">
        <section className="detail-section">
          <h3>What’s missing</h3>
          {lead.assessment.missingInformation.length ? (
            <ul className="missing-info-list">
              {lead.assessment.missingInformation.map((item) => (
                <li key={item}>{helpfulQuestion(item)}</li>
              ))}
            </ul>
          ) : (
            <p className="quiet-copy">No key details to confirm right now.</p>
          )}
        </section>
        <section className="detail-section">
          <h3>Lead facts</h3>
          <dl className="detail-facts">
            <div>
              <dt>Property</dt>
              <dd>{propertyLabel(lead.lead)}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{lead.lead.property.propertyType ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Budget</dt>
              <dd>{currencyRange(lead.lead)}</dd>
            </div>
            <div>
              <dt>Timeline</dt>
              <dd>{timelineLabel(lead.lead)}</dd>
            </div>
            <div>
              <dt>Engagement</dt>
              <dd>
                {lead.lead.engagement.replyCount} replies ·{" "}
                {lead.lead.engagement.viewCount} views ·{" "}
                {lead.lead.engagement.tourRequestCount} tour requests
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                {lead.lead.email ? (
                  <a href={`mailto:${lead.lead.email}`}>{lead.lead.email}</a>
                ) : (
                  "Not provided"
                )}
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>
                {lead.lead.phone ? (
                  <a href={`tel:${lead.lead.phone}`}>{lead.lead.phone}</a>
                ) : (
                  "Not provided"
                )}
              </dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{lead.lead.source}</dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>
                <time dateTime={lead.lead.receivedAt}>
                  {new Intl.DateTimeFormat("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(lead.lead.receivedAt))}
                </time>
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <section className="detail-section">
        <h3>Flags to review</h3>
        {lead.flags.length ? (
          <ul className="flag-explanations">
            {lead.flags.map((flag) => {
              const explanation = flagExplanation(flag);
              if (!explanation) return null;
              return (
                <li key={flag}>
                  <FlagChip flag={flag} />
                  <span>
                    <strong>{explanation.title}.</strong> {explanation.detail}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="quiet-copy">No review flags for this lead.</p>
        )}
      </section>
      <section className="detail-section message-section">
        <h3>Original message · plain text</h3>
        <p className="lead-message">
          {lead.lead.message || "No message provided."}
        </p>
      </section>
      <details className="scoring-details">
        <summary>How this was scored</summary>
        {lead.assessmentSource === "fallback" ? (
          <p className="fallback-honesty">
            Scored by rules, AI explanation unavailable.
          </p>
        ) : (
          <p>
            Assessment source: <strong>Agent</strong>
          </p>
        )}
        <dl className="scoring-facts">
          <div>
            <dt>Adjustments</dt>
            <dd>
              {lead.adjustments.length
                ? lead.adjustments.join("; ")
                : "None recorded"}
            </dd>
          </div>
          <div>
            <dt>Prompt version</dt>
            <dd>{lead.promptVersion}</dd>
          </div>
        </dl>
      </details>
      <div className="detail-actions">
        <div className="detail-navigation" aria-label="Lead navigation">
          <Button size="small" onClick={() => onNavigate(-1)}>
            Previous
          </Button>
          <Button size="small" onClick={() => onNavigate(1)}>
            Next
          </Button>
        </div>
        <div className="detail-safe-actions">
          <Button
            size="small"
            disabled={!contact}
            onClick={() => void copy(contact, "Contact details")}
          >
            Copy contact
          </Button>
          <Button
            size="small"
            variant={isHandled ? "primary" : "secondary"}
            aria-pressed={isHandled}
            onClick={onToggleHandled}
          >
            {isHandled ? "Handled" : "Mark handled"}
          </Button>
        </div>
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {copyFeedback}
      </p>
    </div>
  );
}

function LeadDeskSkeleton({
  scoring = false,
  slow = false,
}: {
  scoring?: boolean;
  slow?: boolean;
}) {
  return (
    <main className="desk-main" aria-label="Loading lead desk">
      <div className="desk-heading">
        <Skeleton className="skeleton-label" />
        <Skeleton className="skeleton-heading" />
        <Skeleton className="skeleton-copy" />
        {scoring ? (
          <p className="scoring-progress" role="status" aria-live="polite">
            {slow
              ? "Still working through the queue. You can keep this page open."
              : "Scoring leads…"}
          </p>
        ) : null}
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
  const selectedId = useSyncExternalStore(
    subscribeToLeadSelection,
    getSelectedLeadFromUrl,
    getServerSelectedLead,
  );
  const [handledIds, setHandledIds] = useState<Set<string>>(() => new Set());
  const ranked = state.status === "ready" ? state.ranked : [];
  const filteredLeads = ranked
    .filter(
      (lead) => priority === "ALL" || lead.assessment.priority === priority,
    )
    .sort((left, right) =>
      sortOrder === "score"
        ? right.assessment.score - left.assessment.score
        : Date.parse(right.lead.receivedAt) - Date.parse(left.lead.receivedAt),
    );
  const selectedIndex = filteredLeads.findIndex(
    (lead) => lead.lead.id === selectedId,
  );
  const selected =
    selectedIndex >= 0 ? filteredLeads[selectedIndex] ?? null : null;

  const writeLeadUrl = (id: string | null, replace: boolean) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("lead", id);
    else url.searchParams.delete("lead");
    const method = replace ? "replaceState" : "pushState";
    window.history[method](id ? { leadDetail: true } : {}, "", url);
    window.dispatchEvent(new Event("lead-selection-change"));
  };

  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (!["ArrowLeft", "ArrowRight", "j", "k"].includes(event.key)) return;
      event.preventDefault();
      const direction: -1 | 1 =
        event.key === "ArrowLeft" || event.key === "k" ? -1 : 1;
      const nextIndex =
        (selectedIndex + direction + filteredLeads.length) %
        filteredLeads.length;
      const next = filteredLeads[nextIndex];
      if (next) writeLeadUrl(next.lead.id, true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredLeads, selected, selectedIndex]);

  if (
    state.status === "loading" ||
    state.status === "scoring" ||
    state.status === "scoring-slow"
  ) {
    return (
      <LeadDeskSkeleton
        scoring={state.status !== "loading"}
        slow={state.status === "scoring-slow"}
      />
    );
  }

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

  const featured = filteredLeads[0];
  const queue = filteredLeads.slice(1);
  const fallbackCount = ranked.filter(
    (lead) => lead.assessmentSource === "fallback",
  ).length;

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
            <strong>{ranked.length}</strong> ready{" "}
            <span aria-hidden="true">·</span> {state.rejected.length} held for
            review
          </span>
        </div>
        <div className="desk-toolbar">
          <Button
            size="small"
            onClick={() => {
              void reload();
            }}
          >
            Re-prioritize
          </Button>
        </div>
      </section>

      <div className="desk-layout">
        {ranked.length === 0 ? (
          <Card className="featured-card empty-feature">
            <p className="eyebrow">NO LEADS YET</p>
            <h2>Your next conversation starts here.</h2>
            <p>
              Add an inquiry to create a ranked lead desk. Import options will
              appear when the intake API contract is connected.
            </p>
          </Card>
        ) : featured ? (
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
              onClick={() => writeLeadUrl(featured.lead.id, false)}
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
            <h2>Nothing in this priority yet.</h2>
            <p>Clear the priority filter to return to the full queue.</p>
            <Button
              size="small"
              onClick={() => setPriority("ALL")}
            >
              Clear filters
            </Button>
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
          <ol className="lead-list" aria-label="Ranked leads" aria-live="polite">
            {queue.map((lead, index) => (
              <LeadRow
                key={lead.lead.id}
                lead={lead}
                rank={index + 2}
                onSelect={() => writeLeadUrl(lead.lead.id, false)}
              />
            ))}
          </ol>
          {queue.length === 0 && featured ? (
            <p className="queue-empty">No other leads in this view.</p>
          ) : null}
        </section>
      </div>

      {fallbackCount > ranked.length / 2 ? (
        <p className="fallback-summary" role="status">
          {fallbackCount} of {ranked.length} leads were scored with fallback
          rules. Their assessments are labeled individually.
        </p>
      ) : null}

      {state.rejected.length ? (
        <section className="rejected-section" aria-labelledby="rejected-title">
          <p className="eyebrow">NEEDS A LOOK</p>
          <h2 id="rejected-title">Not prioritized</h2>
          <p>
            These leads were held back and need review before prioritization.
          </p>
          <ul>
            {state.rejected.map(({ lead, reasons }) => (
              <li key={lead.id}>
                <strong>{lead.name}</strong>
                <span>{reasons.join(" ")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog.Root
        open={selected !== null}
        onOpenChange={(open) => {
          if (open) return;
          if (window.history.state?.leadDetail) {
            window.history.back();
          } else {
            writeLeadUrl(null, true);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          {selected ? (
            <Dialog.Content
              className="dialog-content"
              aria-describedby="lead-detail-description"
            >
              <Dialog.Close asChild>
                <Button
                  className="dialog-close"
                  variant="quiet"
                  aria-label="Close lead details"
                >
                  ×
                </Button>
              </Dialog.Close>
              <p id="lead-detail-description" className="visually-hidden">
                Lead assessment, recommended next step, and source details.
              </p>
              <LeadDetail
                lead={selected}
                onNavigate={(direction) => {
                  const next =
                    filteredLeads[
                      (selectedIndex + direction + filteredLeads.length) %
                        filteredLeads.length
                    ];
                  if (next) writeLeadUrl(next.lead.id, true);
                }}
                isHandled={handledIds.has(selected.lead.id)}
                onToggleHandled={() => {
                  setHandledIds((current) => {
                    const next = new Set(current);
                    if (next.has(selected.lead.id)) next.delete(selected.lead.id);
                    else next.add(selected.lead.id);
                    return next;
                  });
                }}
              />
            </Dialog.Content>
          ) : null}
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
