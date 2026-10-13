import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { GET, POST } from "./route";

function configureCors(t: TestContext, value: string | undefined) {
  const before = process.env.MCP_CORS_ORIGINS;
  if (value === undefined) delete process.env.MCP_CORS_ORIGINS;
  else process.env.MCP_CORS_ORIGINS = value;
  t.after(() => {
    if (before === undefined) delete process.env.MCP_CORS_ORIGINS;
    else process.env.MCP_CORS_ORIGINS = before;
  });
}

async function call(method: string, id: number, params: object) {
  const response = await POST(new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  }));
  assert.equal(response.status, 200);
  const body = await response.text();
  const data = body.split("\n").find((line) => line.startsWith("data: "));
  assert.ok(data);
  return JSON.parse(data.slice(6));
}

test("MCP endpoint initializes and exposes read-only grade tools", async () => {
  const initialized = await call("initialize", 1, {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0" },
  });
  assert.equal(initialized.result.serverInfo.name, "unt-grades");

  const listed = await call("tools/list", 2, {});
  assert.deepEqual(listed.result.tools.map((tool: { name: string }) => tool.name), [
    "search_grades",
    "get_course_grades",
    "get_instructor_courses",
  ]);
  assert.ok(listed.result.tools.every((tool: { annotations: { readOnlyHint?: boolean } }) =>
    tool.annotations.readOnlyHint === true
  ));
});

test("MCP rejects batch amplification before executing any grade tools", async (t) => {
  const { gradeData } = await import("@/lib/mcp-data");
  const search = t.mock.method(gradeData, "search", async () => ({ courses: [], instructors: [] }));
  const message = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_grades", arguments: { query: "CSCE" } } };
  const response = await POST(new Request("http://localhost/api/mcp", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify([message, message]),
  }));
  assert.equal(response.status, 400);
  assert.match(await response.text(), /batch requests are not supported/);
  assert.equal(search.mock.callCount(), 0);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("MCP bounds actual request body bytes before tool work", async (t) => {
  const { gradeData } = await import("@/lib/mcp-data");
  const search = t.mock.method(gradeData, "search", async () => ({ courses: [], instructors: [] }));
  const response = await POST(new Request("http://localhost/api/mcp", {
    method: "POST", body: JSON.stringify({ padding: "x".repeat(32 * 1024) }),
  }));
  assert.equal(response.status, 413);
  assert.equal(search.mock.callCount(), 0);
});

test("MCP rejects malformed JSON and still supports an ordinary tool call", async (t) => {
  const malformed = await POST(new Request("http://localhost/api/mcp", { method: "POST", body: "{" }));
  assert.equal(malformed.status, 400);
  const { gradeData } = await import("@/lib/mcp-data");
  const search = t.mock.method(gradeData, "search", async () => ({ courses: [], instructors: [] }));
  const reply = await call("tools/call", 3, { name: "search_grades", arguments: { query: "CSCE" } });
  assert.deepEqual(reply.result.structuredContent, { courses: [], instructors: [] });
  assert.equal(search.mock.callCount(), 1);
});

test("MCP POST tool calls carry browser CORS without changing the streamed result", async (t) => {
  configureCors(t, "https://planner.example");
  const { gradeData } = await import("@/lib/mcp-data");
  const search = t.mock.method(gradeData, "search", async () => ({ courses: [], instructors: [] }));
  const response = await POST(new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      Origin: "https://planner.example", "Content-Type": "application/json",
      Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/call", params: {
      name: "search_grades", arguments: { query: "CSCE" },
    } }),
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://planner.example");
  assert.equal(response.headers.get("vary"), "Origin");
  assert.equal(response.headers.get("access-control-expose-headers"), "MCP-Session-Id, Retry-After, X-RateLimit-Remaining");
  assert.equal(response.headers.has("access-control-allow-credentials"), false);
  const data = (await response.text()).split("\n").find((line) => line.startsWith("data: "));
  assert.ok(data);
  assert.deepEqual(JSON.parse(data.slice(6)).result.structuredContent, { courses: [], instructors: [] });
  assert.equal(search.mock.callCount(), 1);
});

test("MCP validation and transport errors carry CORS only for allowed origins", async (t) => {
  configureCors(t, "https://planner.example");
  for (const origin of ["https://planner.example", "https://other.example"]) {
    const cases = [
      await POST(new Request("http://localhost/api/mcp", { method: "POST", headers: { origin }, body: "{" })),
      await POST(new Request("http://localhost/api/mcp", { method: "POST", headers: { origin }, body: "[]" })),
      await POST(new Request("http://localhost/api/mcp", { method: "POST", headers: { origin }, body: JSON.stringify({ padding: "x".repeat(32 * 1024) }) })),
      await GET(new Request("http://localhost/api/mcp", { headers: { origin } })),
    ];
    assert.deepEqual(cases.map((response) => response.status), [400, 400, 413, 405]);
    for (const response of cases) {
      if (origin === "https://planner.example") assert.equal(response.headers.get("access-control-allow-origin"), origin);
      else assert.ok([...response.headers.keys()].every((name) => !name.startsWith("access-control-")));
      await response.text();
    }
  }
});

test("MCP requests without Origin keep response status, body and headers unchanged", async (t) => {
  configureCors(t, "*");
  const response = await POST(new Request("http://localhost/api/mcp", { method: "POST", body: "{" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid JSON body" });
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.equal(response.headers.has("vary"), false);
  assert.ok([...response.headers.keys()].every((name) => !name.startsWith("access-control-")));
});

test("MCP rebuilds consumed streaming requests from fields and removes stale Content-Length", async (t) => {
  const { NextRequest } = await import("next/server");
  const NativeRequest = globalThis.Request;
  const url = "https://www.untgrades.app/api/mcp";
  const payload = JSON.stringify({
    jsonrpc: "2.0", id: 99, method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "streamed café", version: "1.0" } },
  }, null, 2);
  const bytes = new TextEncoder().encode(payload);
  const controller = new AbortController();
  const incoming = new NextRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25", "Content-Length": String(bytes.length),
      "X-Request-Test": "preserved",
    },
    body: new ReadableStream({ start(stream) { stream.enqueue(bytes); stream.close(); } }),
    signal: controller.signal,
  });
  const rebuilt: Request[] = [];
  class HostedRequest extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      // Model hosted Request implementations that cannot copy a consumed body.
      if (input instanceof NativeRequest && input.bodyUsed) throw new TypeError("Cannot copy a consumed request");
      super(input, init);
      if (input === url) rebuilt.push(this);
    }
  }
  globalThis.Request = HostedRequest;
  t.after(() => { globalThis.Request = NativeRequest; });
  const response = await POST(incoming);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /"name":"unt-grades"/);
  assert.equal(incoming.bodyUsed, true);
  assert.equal(rebuilt.length, 1);
  assert.equal(rebuilt[0].url, url);
  assert.equal(rebuilt[0].method, "POST");
  assert.equal(rebuilt[0].headers.has("content-length"), false);
  assert.equal(rebuilt[0].headers.get("mcp-protocol-version"), "2025-11-25");
  assert.equal(rebuilt[0].headers.get("x-request-test"), "preserved");
  controller.abort();
  assert.equal(rebuilt[0].signal.aborted, true);
});

test("MCP does not disguise internal request-construction failures as invalid client JSON", async (t) => {
  const NativeRequest = globalThis.Request;
  const incoming = new NativeRequest("https://www.untgrades.app/api/mcp", { method: "POST", body: "{}" });
  const failure = new Error("Synthetic request-construction failure");
  class BrokenRequest extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(input, init); throw failure; }
  }
  globalThis.Request = BrokenRequest;
  t.after(() => { globalThis.Request = NativeRequest; });
  await assert.rejects(POST(incoming), (error: unknown) => error === failure);
});
