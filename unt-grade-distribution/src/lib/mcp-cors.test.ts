import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mcpCorsHeaders, withMcpCors } from "./mcp-cors";

function configure(t: TestContext, value: string) {
  const before = process.env.MCP_CORS_ORIGINS;
  process.env.MCP_CORS_ORIGINS = value;
  t.after(() => {
    if (before === undefined) delete process.env.MCP_CORS_ORIGINS;
    else process.env.MCP_CORS_ORIGINS = before;
  });
}

test("an empty MCP allowlist disables browser CORS", (t) => {
  configure(t, " , ");
  const headers = mcpCorsHeaders(new Request("http://localhost/api/mcp", { headers: { origin: "https://planner.example" } }));
  assert.deepEqual([...headers], [["vary", "Origin"]]);
});

test("MCP CORS preserves existing Vary fields, response status, session headers and body", async (t) => {
  configure(t, "https://planner.example");
  const request = new Request("http://localhost/api/mcp", { headers: { origin: "https://planner.example" } });
  for (const [before, after] of [["Accept", "Accept, Origin"], ["Accept, origin", "Accept, origin"], ["*", "*"]]) {
    const response = new Response("transport failure", { status: 500, headers: { Vary: before, "MCP-Session-Id": "test-session" } });
    assert.equal(withMcpCors(request, response), response);
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("vary"), after);
    assert.equal(response.headers.get("mcp-session-id"), "test-session");
    assert.equal(response.headers.get("access-control-allow-origin"), "https://planner.example");
    assert.equal(await response.text(), "transport failure");
  }
});

test("MCP browser allowlist leaves extension origins to the existing proxy policy", (t) => {
  configure(t, "*");
  const headers = mcpCorsHeaders(new Request("http://localhost/api/mcp", { headers: { origin: "chrome-extension://test-extension" } }));
  assert.deepEqual([...headers], []);
});
