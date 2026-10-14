"use client";

import { useState } from "react";
import type { Priority } from "../../../lib/types/lead";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Skeleton,
  Tabs,
  Tooltip,
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

const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const confidences = ["LOW", "MEDIUM", "HIGH"] as const;
const sampleReasons = [
  "Requested a private showing for this week.",
  "Confirmed a budget aligned with the property.",
  "Asked for the disclosures before scheduling.",
];
const sampleFlags = [
  "DUPLICATE: Possible duplicate lead.",
  "CONFLICT: Budget maximum is below asking price.",
  "STALE: Lead was received beyond the stale threshold.",
  "REENGAGED: New activity followed a long inactivity gap.",
];

export default function DesignShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <main className="design-main">
      <p className="eyebrow">LEADSCALE / WORKING SYSTEM</p>
      <h1>Design notes</h1>
      <p className="design-intro">
        Editorial type, warm paper, and clear signals. This page is a working
        review surface for the components used in the lead desk.
      </p>

      <section className="design-section">
        <h2>Typography</h2>
        <div className="type-specimen">
          <span>Clarity before activity.</span>
          <span>One good next step.</span>
          <span>Ranked conversations</span>
          <span>
            Every lead should have a readable action and enough context to act
            with confidence.
          </span>
          <span>LABEL / RECEIVED JUST NOW / LOW PRIORITY</span>
        </div>
      </section>

      <section className="design-section">
        <h2>Priority, confidence &amp; score</h2>
        <div className="design-row">
          {priorities.map((priority) => (
            <PriorityBadge key={priority} priority={priority} />
          ))}
          {confidences.map((confidence) => (
            <ConfidenceIndicator key={confidence} confidence={confidence} />
          ))}
          {[0, 47, 100].map((score) => (
            <ScoreMark key={score} score={score} />
          ))}
        </div>
      </section>

      <section className="design-section">
        <h2>Sources &amp; flags</h2>
        <div className="design-row">
          <SourceTag source="Website inquiry" />
          <SourceTag source="Property portal" mode="fallback" />
          {sampleFlags.map((flag) => (
            <FlagChip key={flag} flag={flag} />
          ))}
        </div>
      </section>

      <section className="design-section">
        <h2>Buttons &amp; badges</h2>
        <div className="design-row">
          <Button variant="primary">Primary action</Button>
          <Button variant="secondary">Secondary action</Button>
          <Button variant="quiet">Quiet action</Button>
          <Button size="small">Compact</Button>
          <Button disabled>Unavailable</Button>
          <Button aria-label="Example icon button">
            <span aria-hidden="true">+</span>
            <VisuallyHidden>Add lead</VisuallyHidden>
          </Button>
          <Badge>Neutral</Badge>
          <Badge tone="accent">Needs review</Badge>
          <Badge tone="success">Contactable</Badge>
        </div>
      </section>

      <section className="design-section">
        <h2>Card, reasons &amp; action</h2>
        <Card className="design-card">
          <p className="eyebrow">WHY THIS LEAD</p>
          <ReasonList reasons={sampleReasons} />
          <div className="design-stack" style={{ marginTop: "var(--space-5)" }}>
            <NextActionCallout action="Call Maya now to confirm the Saturday tour window and access details." />
            <MissingInfoList
              items={["Preferred tour time", "Financing confirmation"]}
            />
            <MissingInfoList items={[]} />
          </div>
        </Card>
      </section>

      <section className="design-section">
        <h2>Tabs &amp; tooltip</h2>
        <Tabs.Root defaultValue="assessment">
          <Tabs.List
            className="design-tabs-list"
            aria-label="Component preview tabs"
          >
            <Tabs.Trigger className="design-tabs-trigger" value="assessment">
              Assessment
            </Tabs.Trigger>
            <Tabs.Trigger className="design-tabs-trigger" value="contact">
              Contact
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content className="design-tabs-content" value="assessment">
            <Tooltip content="High confidence means several specific, consistent signals support this assessment.">
              <button
                className="confidence-help"
                type="button"
                aria-label="Confidence definition"
              >
                ?
              </button>
            </Tooltip>
            <span> Hover or focus the question mark.</span>
          </Tabs.Content>
          <Tabs.Content className="design-tabs-content" value="contact">
            Contact fields stay in the detail view.
          </Tabs.Content>
        </Tabs.Root>
      </section>

      <section className="design-section">
        <h2>Dialog &amp; loading</h2>
        <div className="design-stack">
          <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
            <Dialog.Trigger asChild>
              <Button className="design-dialog-trigger" variant="secondary">
                Open dialog preview
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="dialog-overlay" />
              <Dialog.Content className="dialog-content">
                <Dialog.Close asChild>
                  <Button
                    className="dialog-close"
                    variant="quiet"
                    aria-label="Close preview"
                  >
                    ×
                  </Button>
                </Dialog.Close>
                <Dialog.Title className="detail-title">
                  A focused detail surface
                </Dialog.Title>
                <Dialog.Description className="design-dialog-copy">
                  Dialog handles focus, Escape, and return focus with Radix
                  primitives.
                </Dialog.Description>
                <NextActionCallout action="Call the lead to confirm a viewing time." />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <Skeleton className="design-skeleton" />
        </div>
      </section>
    </main>
  );
}
