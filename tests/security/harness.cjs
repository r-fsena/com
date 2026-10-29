const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
const empty = () => ({ contacts: [], conversations: [], messages: [], deals: [], aiInsights: {}, quickReplies: [] });
function harness(overrides = {}, environment = {}) {
  const cache = new Map();
  const env = { NODE_ENV: 'production', SESSION_SECRET: 'test-only-secret-with-more-than-32-characters', ZAPI_WEBHOOK_SECRET: 'test-webhook-secret', ...environment };
  const mocks = {
    'next/server': { NextRequest, NextResponse },
    '@/db': { db: {} },
    '@/lib/server-crm-store': { serverCRMStore: { getUsers: () => [], getScopedState: empty, getState: empty, updateState: () => {}, resetTenantState: () => {} } },
    '@/lib/rate-limiter': { checkRateLimit: () => ({ allowed: true }), getClientIp: () => 'test' },
    '@/lib/webhook-store': { webhookStore: { addMessage: value => value } },
    '@/lib/cloudwatch-logger': { recordExtensionLog: async () => {} },
    ...overrides,
  };
  function load(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute);
    const result = {};
    cache.set(absolute, result);
    const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    const localRequire = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('@/')) return load(`src/${id.slice(2)}${id === '@/db' ? '/index' : ''}.ts`);
      if (id.startsWith('.')) return load(path.resolve(path.dirname(absolute), `${id}.ts`));
      return require(id);
    };
    vm.runInNewContext(source, { exports: result, require: localRequire, process: { env }, Buffer, console: { ...console, error: () => {} }, URL, Headers, Response, AbortSignal, fetch: mocks.fetch || (() => { throw new Error('Network disabled in tests'); }), setTimeout, clearTimeout }, { filename: absolute });
    return result;
  }
  function request(url, body, headers = {}, method) {
    return new NextRequest(`https://crm.test${url}`, { method: method || (body === undefined ? 'GET' : 'POST'), headers: { 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  return { load, request, mocks, env };
}
module.exports = { harness, empty };
