# Lead Desk Demo Notes

## Current fixture walkthrough

1. Open the desk with `NEXT_PUBLIC_USE_FIXTURES` unset or set to `true`; the header identifies the data as demo data.
2. Point out the featured lead's score, priority, confidence, evidence, and single recommended next step.
3. Open Maya Chen, then use the detail panel to show the helpful follow-up, plain-text original message, and safe copy/handled actions.
4. Open Elliot Brooks to show the conflicting-details flag and the honest fallback explanation under “How this was scored.”
5. Open Samir Patel to show the possible-duplicate explanation. Use Previous/Next or the left/right arrow keys (or `j`/`k`) to navigate.
6. Show “Not prioritized” below the ranked desk for the fixture rejection reasons.

## UI notes

- The featured lead and compact queue make the next conversation easy to find; score and priority always have text labels.
- “Why” uses evidence from the assessment, while “What’s missing” turns gaps into calm follow-up questions.
- Flags explain what to check next instead of implying a lead is at fault.
- The original message is rendered as plain text. No action sends a message to a lead.
- Fallback assessments are labeled as rules-scored, with adjustments and prompt version shown separately.
- Lead details are shareable through the `?lead=<id>` URL and use a keyboard-managed Radix dialog.

## Integration blocker

The intake workflow and status/demo switches are not connected in this checkout. The email intake handler currently returns “not implemented”; CSV/manual intake and `/api/status` are absent. `docs/API.md` and Sarah’s confirmed request/response shapes are needed before the sample CSV import and live/mode-switch demo can be rehearsed. Do not present the current preloaded fixture walkthrough as an import demonstration.
