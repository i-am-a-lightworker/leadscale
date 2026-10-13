import { createHarness } from "@strands-agents/harness";
import { OpenAIModel } from "@strands-agents/sdk/models/openai";
import { AGENT_SYSTEM_PROMPT } from "./instructions";
import { AssessmentSchema } from "../types/lead";
import type { ScoreBreakdown } from "./scoring";
import type { LeadRepository } from "../data/leadRepository";
import { createGetLeadTool, GET_LEAD_DEFAULT_MAX_CHARS } from "./tools/getLead";

export type AgentInput = {
  leadId: string;
  preScore: number;
  breakdown: ScoreBreakdown;
  flags: string[];
  missingInformation: string[];
  repairInstruction?: string;
  signal?: AbortSignal;
};

export type ModelRunner = (input: AgentInput) => Promise<unknown>;

export const AGENT_MODEL_CONFIG = { temperature: 0.1 } as const;

export type CreateLeadAgentOptions = {
  repository: LeadRepository;
  modelName?: string;
  apiKey?: string;
  maxMessageChars?: number;
};

function buildUserPrompt(input: AgentInput): string {
  return JSON.stringify({
    task: "Assess this lead using get_lead, then return only an Assessment JSON object.",
    leadId: input.leadId,
    deterministicPreScore: input.preScore,
    scoreBreakdown: input.breakdown,
    filterFlags: input.flags,
    knownMissingInformation: input.missingInformation,
    repairInstruction: input.repairInstruction,
  });
}

export async function createLeadAgent(options: CreateLeadAgentOptions): Promise<ModelRunner> {
  const modelName = options.modelName?.trim() || process.env.AGENT_MODEL?.trim();
  if (!modelName) throw new Error("AGENT_MODEL must be set when AGENT_MODE=live.");

  const model = new OpenAIModel({
    api: "chat",
    modelId: modelName,
    temperature: AGENT_MODEL_CONFIG.temperature,
    ...(options.apiKey ?? process.env.OPENAI_API_KEY
      ? { apiKey: options.apiKey ?? process.env.OPENAI_API_KEY }
      : {}),
  });
  const agent = await createHarness({
    model,
    systemPrompt: AGENT_SYSTEM_PROMPT,
    tools: [createGetLeadTool({
      repository: options.repository,
      maxMessageChars: options.maxMessageChars ?? parseMessageLimit(),
    })],
    structuredOutputSchema: AssessmentSchema,
    builtinTools: [],
    builtinPlugins: [],
    session: false,
    skills: false,
    memory: false,
    contextManager: false,
    caching: false,
    backgroundTasks: false,
    printer: false,
    retryStrategy: null,
  });

  return async (input) => {
    const result = await agent.invoke(buildUserPrompt(input), {
      ...(input.signal ? { cancelSignal: input.signal } : {}),
    });
    return result.structuredOutput ?? result.toString();
  };
}

function parseMessageLimit(): number {
  const configured = Number(process.env.LEAD_MESSAGE_MAX_CHARS);
  return Number.isInteger(configured) && configured > 0 ? configured : GET_LEAD_DEFAULT_MAX_CHARS;
}

export function runLeadAgent(input: AgentInput, modelRunner: ModelRunner): Promise<unknown> {
  return modelRunner(input);
}