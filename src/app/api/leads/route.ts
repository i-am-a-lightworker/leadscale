import { LeadSchema } from "../../../../lib/types/lead";
import { getLeadRepository } from "../../../../lib/data";
import { getMockSimulation, waitForDemoSimulation } from "../../../../lib/demo/simulations";
import { guardProtectedRoute } from "../../../../lib/security/routeGuard";

export async function GET(request: Request): Promise<Response> {
  const accessError = guardProtectedRoute(request, "intake");
  if (accessError) return accessError;
  const simulation = getMockSimulation(request);
  if (simulation === "empty") return Response.json([]);
  if (simulation === "error") return Response.json({ error: { code: "LEADS_UNAVAILABLE", message: "Leads could not be retrieved." } }, { status: 500 });
  await waitForDemoSimulation(simulation);
  try {
    const leads = await getLeadRepository().list();
    return Response.json(LeadSchema.array().parse(leads), { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json(
      { error: { code: "LEADS_UNAVAILABLE", message: "Leads could not be retrieved." } },
      { status: 500 },
    );
  }
}