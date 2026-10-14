export const DEMO_SIMULATION_CONFIG = {
  slowDelayMs: 1_200,
} as const;

export type MockSimulation = "empty" | "error" | "slow" | "fallback";

export function getMockSimulation(request: Request): MockSimulation | undefined {
  if (process.env.AGENT_MODE !== "mock") return undefined;
  const simulation = new URL(request.url).searchParams.get("simulate");
  return simulation === "empty" || simulation === "error" || simulation === "slow" || simulation === "fallback"
    ? simulation
    : undefined;
}

export async function waitForDemoSimulation(simulation: MockSimulation | undefined): Promise<void> {
  if (simulation === "slow") await new Promise((resolve) => setTimeout(resolve, DEMO_SIMULATION_CONFIG.slowDelayMs));
}