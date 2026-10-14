import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { guardProtectedRoute } from "../lib/security/routeGuard";
import { createSvixSignature } from "../lib/security/svixSignature";

const originalSecret = process.env.ROUTE_SHARED_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.ROUTE_SHARED_SECRET;
  else process.env.ROUTE_SHARED_SECRET = originalSecret;
});

describe("protected API route guard", () => {
  it("requires the configured shared secret and compares it using the request header", () => {
    process.env.ROUTE_SHARED_SECRET = "test-only-shared-secret";
    const denied = guardProtectedRoute(new Request("http://localhost/api/security-auth"), "intake");
    const allowed = guardProtectedRoute(new Request("http://localhost/api/security-auth", {
      headers: { "x-api-key": "test-only-shared-secret" },
    }), "intake");
    expect(denied?.status).toBe(401);
    expect(allowed).toBeUndefined();
  });

  it("rejects cross-origin browser requests", () => {
    const response = guardProtectedRoute(new Request("https://leadscale.example/api/security-origin", {
      headers: { origin: "https://attacker.example" },
    }), "intake");
    expect(response?.status).toBe(403);
  });

  it("rate-limits repeated requests within a per-process window", () => {
    const pathname = `/api/security-rate-${randomUUID()}`;
    let finalResponse: Response | undefined;
    for (let index = 0; index < 21; index += 1) {
      finalResponse = guardProtectedRoute(new Request(`http://localhost${pathname}`), "intake");
    }
    expect(finalResponse?.status).toBe(429);
    expect(finalResponse?.headers.get("retry-after")).toBeTruthy();
  });
});

describe("Svix smoke signature", () => {
  it("matches the published Svix signature example", () => {
    const signature = createSvixSignature(
      "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
      "msg_p5jXN8AQM9LWM0D4loKWxJek",
      "1614265330",
      '{"test": 2432232314}',
    );
    expect(signature).toBe("v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=");
  });
});