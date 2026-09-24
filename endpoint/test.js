// Local e2e test for the agent-authority HTTP endpoint.
// Boots server.js, exercises /health, /evaluate (allow + ask + deny), /validate, CORS.
import { spawn } from "node:child_process";

const PORT = 3495;
const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const check = (n, c, d) => { if (c) { pass++; console.log("PASS " + n); } else { fail++; console.log("FAIL " + n + " :: " + d); } };

const srv = spawn("node", ["server.js"], { env: { ...process.env, PORT: String(PORT) } });
await new Promise(r => setTimeout(r, 1200));

async function post(path, body) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json() };
}

try {
  const health = await fetch(BASE + "/health").then(r => r.json());
  check("health ok", health.ok === true && health.service === "agent-authority");

  const contract = {
    version: "0.1",
    contractId: "contract_test_1",
    subjectAgentId: "agent_alice",
    issuer: "issuer_corp",
    purpose: "test",
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    capabilities: [{ resource: "box", actions: ["read"], constraints: { cwd: "workspace" }, decision: "allow" }]
  };

  const allow = await post("/evaluate", { contract, request: { agentId: "agent_alice", resource: "box", action: "read", input: { cwd: "workspace" } } });
  check("allow: matched works", allow.status === 200 && allow.json.decision === "allow", JSON.stringify(allow.json));

  const wrongAgent = await post("/evaluate", { contract, request: { agentId: "agent_evil", resource: "box", action: "read", input: { cwd: "workspace" } } });
  check("deny: wrong agent", wrongAgent.status === 200 && wrongAgent.json.decision === "deny", JSON.stringify(wrongAgent.json));

  const askContract = { ...contract, approvals: { requiredFor: ["box:read"] } };
  const ask = await post("/evaluate", { contract: askContract, request: { agentId: "agent_alice", resource: "box", action: "read", input: { cwd: "workspace" } } });
  check("ask: requires approval", ask.status === 200 && ask.json.decision === "ask", JSON.stringify(ask.json));

  const val = await post("/validate", { contract });
  check("validate: valid contract", val.status === 200 && val.json.valid === true && val.json.errors.length === 0, JSON.stringify(val.json));

  const bad = await post("/evaluate", {});
  check("evaluate: missing body -> 400", bad.status === 400);

  const cors = await fetch(BASE + "/health", { headers: { Origin: "https://agentos-landing.vercel.app" } });
  check("CORS header present", (cors.headers.get("access-control-allow-origin") || "") === "*");
} catch (e) {
  fail++;
  console.log("EXC: " + e.message);
} finally {
  srv.kill();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);