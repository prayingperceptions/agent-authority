// server.js — Agent Authority HTTP endpoint (zero-dependency Node).
// Thin wrapper over agent-authority-core. Endpoints:
//   GET  /health   -> status
//   GET  /         -> endpoints list
//   POST /evaluate -> { contract, request } -> allow/ask/deny (live)
//   POST /validate -> { contract } -> validation errors
// CORS: Access-Control-Allow-Origin:* so the live browser demo can call it.
import http from 'node:http';
import { evaluate, validateContract } from './core.js';

const PORT = parseInt(process.env.PORT || '8786', 10);

function send(res, status, obj, addHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    ...addHeaders
  });
  res.end(JSON.stringify(obj, null, 2));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { return { __invalid: true }; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const method = req.method;
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    // CORS preflight: must be handled for the browser demo (POST with JSON).
    if (method === 'OPTIONS') {
      return send(res, 204, {}, {}); // 204 + CORS headers; no body
    }
    if (method === 'GET' && path === '/health') {
      return send(res, 200, { ok: true, service: 'agent-authority', version: '0.1.6' });
    }

    if (method === 'GET' && path === '/') {
      return send(res, 200, { service: 'agent-authority', endpoints: ['/health', '/evaluate', '/validate'] });
    }

    if (method === 'POST' && path === '/evaluate') {
      const body = await readBody(req);
      if (body.__invalid || !body.contract || !body.request) {
        return send(res, 400, { error: 'body requires { contract, request }' });
      }
      const result = evaluate(body.contract, body.request);
      return send(res, 200, { ...result, evaluatedAt: new Date().toISOString() });
    }

    if (method === 'POST' && path === '/validate') {
      const body = await readBody(req);
      if (body.__invalid || !body.contract) {
        return send(res, 400, { error: 'body requires { contract }' });
      }
      const errors = validateContract(body.contract);
      return send(res, 200, { valid: errors.length === 0, errors });
    }

    return send(res, 404, { error: 'not found', endpoints: ['/health', '/evaluate', '/validate'] });
  } catch (err) {
    console.error('Unhandled server error:', err);
    send(res, 500, { error: 'internal_error' });
  }
});

server.listen(PORT, () => console.log(`agent-authority listening on :${PORT}`));