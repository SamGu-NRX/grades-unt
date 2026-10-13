export function mcpCorsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("origin");
  // Extension origins keep the proxy's existing extension policy.
  if (!origin || origin.startsWith("chrome-extension://")) return headers;

  // Public, read-only tools need no credentials. An explicit empty list disables browser access.
  const origins = (process.env.MCP_CORS_ORIGINS ?? "*").split(",").map((value) => value.trim());
  const wildcard = origins.includes("*");
  if (!wildcard) headers.set("Vary", "Origin");
  if (!wildcard && !origins.includes(origin)) return headers;

  headers.set("Access-Control-Allow-Origin", wildcard ? "*" : origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, MCP-Session-Id, MCP-Protocol-Version, Last-Event-ID");
  headers.set("Access-Control-Expose-Headers", "MCP-Session-Id, Retry-After, X-RateLimit-Remaining");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

export function withMcpCors(request: Request, response: Response): Response {
  for (const [name, value] of mcpCorsHeaders(request)) {
    if (name === "vary") {
      const vary = response.headers.get("vary")?.split(",").map((field) => field.trim().toLowerCase()) ?? [];
      if (!vary.includes("origin") && !vary.includes("*")) response.headers.append(name, value);
    } else {
      response.headers.set(name, value);
    }
  }
  return response;
}
