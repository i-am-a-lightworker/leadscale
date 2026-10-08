import {
  LeadSchema,
  type FilterResult,
  type Lead,
} from "../types/lead";

export const FILTER_CONFIG = {
  staleAfterDays: 14,
  reengagementGapDays: 30,
  recentReengagementWindowDays: 7,
  conflictBudgetBelowAskingPriceRatio: 0.7,
} as const;

export type FilterContext = {
  // Inject a fixed reference timestamp to evaluate future, stale, and re-engagement rules.
  now?: string;
  batch?: readonly unknown[];
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function isLeadSchemaValid(input: unknown): input is Lead {
  return LeadSchema.safeParse(input).success;
}

export function hasNoContactMethod(input: unknown): boolean {
  if (typeof input !== "object" || input === null) return true;
  const contact = input as { email?: unknown; phone?: unknown };
  return !contact.email && !contact.phone;
}

function hasPropertyDetails(lead: Lead): boolean {
  const property = lead.property;
  return Boolean(property.address || property.city || property.propertyType || property.askingPrice !== undefined);
}

export function isSpamTestLead(lead: Lead): boolean {
  const email = lead.email?.trim().toLowerCase();
  const message = lead.message.trim();
  const knownTestEmail =
    email === "test@test.com" ||
    email?.endsWith("@example.invalid") === true ||
    email?.endsWith("@test.invalid") === true;
  const testMessage =
    /^(?:asdf|asdfghjkl|qwer|zxcv|qwerty|lorem ipsum|test message)[\s\d!?.-]*$/i.test(message);

  return (
    knownTestEmail ||
    testMessage ||
    (message.length === 0 && !hasPropertyDetails(lead))
  );
}

export function wasReceivedInFuture(lead: Lead, now: string): boolean {
  return Date.parse(lead.receivedAt) > Date.parse(now);
}

export function normalizeEmail(email: string | undefined): string | undefined {
  const normalized = email?.trim().toLowerCase();
  return normalized || undefined;
}

export function normalizePhone(phone: string | undefined): string | undefined {
  const normalized = phone?.replace(/\D/g, "");
  return normalized || undefined;
}

function normalizeIdentityText(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

export function areDuplicateLeads(left: Lead, right: Lead): boolean {
  const leftEmail = normalizeEmail(left.email);
  const rightEmail = normalizeEmail(right.email);
  const leftPhone = normalizePhone(left.phone);
  const rightPhone = normalizePhone(right.phone);
  const sameEmail = leftEmail !== undefined && leftEmail === rightEmail;
  const samePhone = leftPhone !== undefined && leftPhone === rightPhone;
  const sameNameAndProperty =
    normalizeIdentityText(left.name) === normalizeIdentityText(right.name) &&
    normalizeIdentityText(left.property.address || left.property.city) !== "" &&
    normalizeIdentityText(left.property.address || left.property.city) ===
      normalizeIdentityText(right.property.address || right.property.city);

  return sameEmail || samePhone || sameNameAndProperty;
}

export function findDuplicatePrimary(lead: Lead, batch: readonly Lead[]): Lead | undefined {
  const component = new Map<string, Lead>([[lead.id, lead]]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const candidate of batch) {
      if (component.has(candidate.id)) continue;
      if ([...component.values()].some((member) => areDuplicateLeads(member, candidate))) {
        component.set(candidate.id, candidate);
        changed = true;
      }
    }
  }

  const primary = [...component.values()].sort((left, right) => {
    const receivedDifference = Date.parse(right.receivedAt) - Date.parse(left.receivedAt);
    return receivedDifference || left.id.localeCompare(right.id);
  })[0];
  return primary?.id === lead.id ? undefined : primary;
}

export function hasConflictingBudget(lead: Lead): boolean {
  const askingPrice = lead.property.askingPrice;
  const budgetMax = lead.budget.max;
  return (
    askingPrice !== undefined &&
    budgetMax !== undefined &&
    budgetMax < askingPrice * FILTER_CONFIG.conflictBudgetBelowAskingPriceRatio
  );
}

export function isStaleLead(lead: Lead, now: string): boolean {
  const ageInDays = (Date.parse(now) - Date.parse(lead.receivedAt)) / DAY_IN_MS;
  return ageInDays > FILTER_CONFIG.staleAfterDays;
}

export function isRecentlyReengaged(lead: Lead, now: string): boolean {
  const previousActivity = lead.engagement.previousActivityAt;
  const lastActivity = lead.engagement.lastActivityAt;
  if (!previousActivity || !lastActivity) return false;

  const gapInDays = (Date.parse(lastActivity) - Date.parse(previousActivity)) / DAY_IN_MS;
  const daysSinceLastActivity = (Date.parse(now) - Date.parse(lastActivity)) / DAY_IN_MS;
  return (
    gapInDays >= FILTER_CONFIG.reengagementGapDays &&
    daysSinceLastActivity >= 0 &&
    daysSinceLastActivity <= FILTER_CONFIG.recentReengagementWindowDays
  );
}

function getRejectedReasons(input: unknown, now: string): string[] {
  const reasons: string[] = [];
  if (!isLeadSchemaValid(input)) reasons.push("Lead failed schema validation.");
  if (hasNoContactMethod(input)) reasons.push("Lead has no usable email address or phone number.");

  if (isLeadSchemaValid(input)) {
    if (isSpamTestLead(input)) reasons.push("Lead appears to be a spam or test record.");
    if (wasReceivedInFuture(input, now)) reasons.push("Lead receivedAt is in the future.");
  }
  return reasons;
}

export function filterLead(input: unknown, context: FilterContext = {}): FilterResult {
  const now =
    context.now ??
    (isLeadSchemaValid(input) ? input.receivedAt : new Date(0).toISOString());
  const rejectedReasons = getRejectedReasons(input, now);
  if (rejectedReasons.length > 0) {
    return { status: "rejected", lead: input, reasons: rejectedReasons };
  }

  const lead = LeadSchema.parse(input);
  const flags: string[] = [];
  const batch = (context.batch ?? [lead]).filter(isLeadSchemaValid);
  const duplicatePrimary = findDuplicatePrimary(lead, batch);

  if (duplicatePrimary) flags.push(`DUPLICATE: Duplicate of primary lead ${duplicatePrimary.id}.`);
  if (hasConflictingBudget(lead)) flags.push("CONFLICT: Budget maximum is far below the property asking price.");
  if (isStaleLead(lead, now)) flags.push("STALE: Lead was received beyond the stale threshold.");
  if (isRecentlyReengaged(lead, now)) {
    flags.push("REENGAGED: New activity followed a long inactivity gap.");
  }

  return flags.length > 0 ? { status: "flagged", lead, flags } : { status: "eligible", lead };
}

export function filterLeads(leads: readonly unknown[], context: Omit<FilterContext, "batch"> = {}): FilterResult[] {
  const validBatch = leads.filter(isLeadSchemaValid);
  const batch = validBatch;
  return leads.map((lead) => filterLead(lead, { ...context, batch }));
}
