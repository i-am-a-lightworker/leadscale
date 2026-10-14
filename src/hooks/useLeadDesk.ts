"use client";

import { useEffect, useState } from "react";
import type { PrioritizedLead } from "../../lib/types/lead";
import {
  fetchLeads,
  fetchPrioritized,
  LeadClientError,
} from "../../lib/client/leadClient";
import type { PrioritizeResult } from "../../lib/client/fixtures";

export type DeskLead = PrioritizedLead & {
  assessmentSource: "agent" | "fallback";
  flags: string[];
  adjustments: string[];
  promptVersion: string;
};

export type LeadDeskState =
  | { status: "loading" }
  | { status: "scoring" }
  | { status: "scoring-slow" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      ranked: DeskLead[];
      rejected: PrioritizeResult["rejected"];
      leadCount: number;
    };

async function loadDeskState(): Promise<LeadDeskState> {
  const [result, leads] = await Promise.all([fetchPrioritized(), fetchLeads()]);
  const metaById = new Map(result.meta.map((meta) => [meta.leadId, meta]));
  const ranked = result.ranked.map((entry) => {
    const meta = metaById.get(entry.lead.id);
    return {
      ...entry,
      assessmentSource: meta?.source ?? "agent",
      flags: meta?.flags ?? [],
      adjustments: meta?.adjustments ?? [],
      promptVersion: meta?.promptVersion ?? "Unavailable",
    } satisfies DeskLead;
  });
  return {
    status: "ready",
    ranked,
    rejected: result.rejected,
    leadCount: leads.length,
  };
}

function errorState(error: unknown): LeadDeskState {
  return {
    status: "error",
    message:
      error instanceof LeadClientError
        ? error.message
        : "The lead desk could not load. Please retry.",
  };
}

export function useLeadDesk() {
  const [state, setState] = useState<LeadDeskState>({ status: "loading" });

  useEffect(() => {
    if (state.status !== "scoring") return;
    const timer = window.setTimeout(() => {
      setState((current) =>
        current.status === "scoring" ? { status: "scoring-slow" } : current,
      );
    }, 8_000);
    return () => window.clearTimeout(timer);
  }, [state.status]);

  useEffect(() => {
    let active = true;
    void loadDeskState()
      .then((nextState) => {
        if (active) setState(nextState);
      })
      .catch((error: unknown) => {
        if (active) setState(errorState(error));
      });
    return () => {
      active = false;
    };
  }, []);

  async function reload() {
    setState({ status: "scoring" });
    try {
      setState(await loadDeskState());
    } catch (error) {
      setState(errorState(error));
    }
  }

  return { state, reload };
}
