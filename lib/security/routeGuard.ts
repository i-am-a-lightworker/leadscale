import { timingSafeEqual } from "node:crypto";
import { ROUTE_SECURITY_CONFIG } from "./config";

type RateLimitEntry = { startedAt: number; count: number };
type RateLimitStore = Map<string, RateLimitEntry>;
type RateLimitGlobal = typeof globalThis & { __leadscaleRateLimits?: RateLimitStore };

function rateLimitStore(): RateLimitStore {
  const runtime = globalThis as RateLimitGlobal;
  runtime.__leadscaleRateLimits ??= new Map();
  return runtime.__leadscaleRateLimits;
}

function rateLimit(request: Request, scope: "intake" | "prioritize"): Response | undefined {
  const now = Date.now();
  const key = `${new URL(request.url).pathname}:${scope}`;
  const store = rateLimitStore();
  const entry = store.get(key);
  const maxRequests = scope === "prioritize"
    ? ROUTE_SECURITY_CONFIG.maxPrioritizeRequestsPerWindow
    : ROUTE_SECURITY_CONFIG.maxIntakeRequestsPerWindow;

  if (!entry || now - entry.startedAt >= ROUTE_SECURITY_CONFIG.rateWindowMs) {
    store.set(key, { startedAt: now, count: 1 });
    return undefined;
  }
  if (entry.count >= maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((ROUTE_SECURITY_CONFIG.rateWindowMs - (now - entry.startedAt)) / 1000));
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } },
      { status: 429, headers: { "retry-after": String(retryAfter) } },
    );
  }
  entry.count += 1;
  return undefined;
}

function authorized(request: Request, secret: string): boolean {
  const authorization = request.headers.get("authorization");
  const supplied = request.headers.get("x-api-key") ?? (authorization?.startsWith("Bearer ") ? authorization.slice(7) : "");
  const providedBytes = Buffer.from(supplied);
  const secretBytes = Buffer.from(secret);
  return providedBytes.length === secretBytes.length && timingSafeEqual(providedBytes, secretBytes);
}

export function guardSameOrigin(request: Request): Response | undefined {
  const origin = request.headers.get("origin");
  if (!origin) return undefined;
  try {
    if (new URL(origin).origin === new URL(request.url).origin) return undefined;
  } catch {
    return Response.json({ error: { code: "INVALID_ORIGIN", message: "Request origin is not allowed." } }, { status: 403 });
  }
  return Response.json({ error: { code: "INVALID_ORIGIN", message: "Cross-origin requests are not allowed." } }, { status: 403 });
}

export function guardProtectedRoute(request: Request, scope: "intake" | "prioritize"): Response | undefined {
  const originError = guardSameOrigin(request);
  if (originError) return originError;

  const secret = process.env.ROUTE_SHARED_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return Response.json({ error: { code: "AUTH_NOT_CONFIGURED", message: "Route authentication is not configured." } }, { status: 503 });
  }
  if (secret && !authorized(request, secret)) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "A valid route credential is required." } }, { status: 401 });
  }
  return rateLimit(request, scope);
}