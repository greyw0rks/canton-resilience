#!/usr/bin/env node
// Canton Resilience — automated end-to-end proof of the on-ledger threshold
// workflow. Drives the SAME Daml HTTP JSON API v1 calls that
// app/api/ledger/route.ts makes, against a live LocalNet sandbox, and asserts
// the control-layer invariants hold ON THE LEDGER (not in the UI):
//
//   • a request under threshold cannot execute
//   • a non-member cannot approve
//   • the same party cannot approve twice
//   • once the quorum is met, Execute emits an immutable AuditRecord
//   • the executed state survives re-reading the ledger (persistence)
//
// Prereq: `npm run ledger:up` has written .env.local and the sandbox + JSON API
// are running. Run with: `npm run verify:ledger`.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  let raw;
  try {
    raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
  } catch {
    fail('No .env.local — run `npm run ledger:up` first.');
  }
  const env = {};
  for (const line of raw.split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const LEDGER_URL = env.LEDGER_URL;
const LEDGER_ID = env.LEDGER_ID ?? 'sandbox';
const PKG = env.LEDGER_PACKAGE_ID;
const PARTY_MAP = JSON.parse(env.LEDGER_PARTY_MAP ?? '{}');

if (!LEDGER_URL || !PKG || Object.keys(PARTY_MAP).length === 0) {
  fail('.env.local is missing LEDGER_URL / LEDGER_PACKAGE_ID / LEDGER_PARTY_MAP — re-run `npm run ledger:up`.');
}

const tid = (t) => `${PKG}:Main:${t}`;
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const qualify = (slug) => {
  const p = PARTY_MAP[slug];
  if (!p) fail(`No allocated party for "${slug}"`);
  return p;
};
const deQualify = (party) =>
  Object.entries(PARTY_MAP).find(([, p]) => p === party)?.[0] ?? party;

function mintToken(party) {
  const header = { alg: 'none', typ: 'JWT' };
  const payload = {
    'https://daml.com/ledger-api': {
      ledgerId: LEDGER_ID,
      applicationId: 'canton-resilience',
      actAs: [party],
      readAs: [party],
    },
  };
  return `${b64url(header)}.${b64url(payload)}.`;
}

async function api(party, path, body) {
  const res = await fetch(`${LEDGER_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${mintToken(party)}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = undefined; }
  if (!res.ok || parsed?.status >= 400) {
    const msg = Array.isArray(parsed?.errors) ? parsed.errors.join('; ') : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.ledger = true;
    throw err;
  }
  return parsed;
}

const query = async (readerSlug, template, q) =>
  (await api(qualify(readerSlug), '/v1/query', { templateIds: [template], query: q }))?.result ?? [];
const exercise = (actorSlug, templateId, contractId, choice, argument) =>
  api(qualify(actorSlug), '/v1/exercise', { templateId, contractId, choice, argument });

// --- tiny assertion harness ------------------------------------------------
let passed = 0;
function fail(msg) { console.error(`\n  ✗ ${msg}\n`); process.exit(1); }
function ok(msg) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
async function expectReject(label, fn, match) {
  try {
    await fn();
  } catch (e) {
    if (!e.ledger) throw e;
    if (match && !match.test(e.message)) fail(`${label}: rejected, but with the wrong message: "${e.message}"`);
    ok(`${label} — rejected on-ledger ("${e.message}")`);
    return;
  }
  fail(`${label}: expected the ledger to reject this, but it succeeded`);
}

// --- the application under test (Treasury, 2-of-3) -------------------------
const APP = {
  application: 'Treasury',
  verb: 'TRANSFER',
  target: 'vendor::party',
  detail: 'Outbound vendor payment from the institutional treasury.',
  reference: 'REQ-1042',
};
const MEMBERS = ['alice', 'bob', 'carol']; // threshold 2
const NON_MEMBER = 'dave'; // allocated, but not a Treasury policy member

const findReq = async (readerSlug) =>
  (await query(readerSlug, tid('ActionRequest'), { application: APP.application }))[0];

async function main() {
  console.log(`\nCanton Resilience — on-ledger verification (${LEDGER_URL})\n`);

  // 0. Policy must exist (ledger initialized).
  const policies = await query('alice', tid('Policy'), { application: APP.application });
  if (!policies[0]) fail(`No Policy for "${APP.application}" — run \`npm run ledger:up\`.`);
  ok(`Policy for "${APP.application}" is on the ledger (threshold ${policies[0].payload.threshold})`);

  // 1. Clean slate: withdraw any request left open by a previous run.
  const stale = await findReq('alice');
  if (stale) {
    await exercise('alice', tid('ActionRequest'), stale.contractId, 'Reject', { canceller: qualify('alice') });
    ok('withdrew a stale open request (Reject)');
  }

  // 2. Open a fresh request as the requester (alice).
  await exercise('alice', tid('Policy'), policies[0].contractId, 'RequestAction', {
    requester: qualify('alice'),
    verb: APP.verb, target: APP.target, detail: APP.detail, reference: APP.reference,
  });
  ok(`opened a ${APP.verb} request (${APP.reference})`);

  const req0 = await findReq('alice');

  // 3. NEGATIVE: cannot execute under threshold (0 approvals).
  await expectReject('execute with 0/2 approvals',
    () => exercise('alice', tid('ActionRequest'), req0.contractId, 'Execute', { executor: qualify('alice') }),
    /threshold not met/i);

  // 4. NEGATIVE: a non-member cannot approve. On the ledger the ActionRequest's
  //    observers ARE the policy members (daml/Main.daml), so a true non-member
  //    cannot even see the contract — the ledger blocks them by invisibility
  //    (CONTRACT_NOT_FOUND) before the explicit member-check assertion is
  //    reachable. Either way the approval is impossible for a non-member.
  await expectReject(`approve as non-member (${NON_MEMBER})`,
    () => exercise(NON_MEMBER, tid('ActionRequest'), req0.contractId, 'Approve', { approver: qualify(NON_MEMBER) }),
    /not a policy member|not be found|not found/i);

  // 5. First approval (alice).
  await exercise('alice', tid('ActionRequest'), req0.contractId, 'Approve', { approver: qualify('alice') });
  ok('approved by alice (1/2)');
  const req1 = await findReq('alice');

  // 6. NEGATIVE: the same party cannot approve twice.
  await expectReject('approve twice as alice',
    () => exercise('alice', tid('ActionRequest'), req1.contractId, 'Approve', { approver: qualify('alice') }),
    /already approved/i);

  // 7. NEGATIVE: still under threshold (1/2).
  await expectReject('execute with 1/2 approvals',
    () => exercise('alice', tid('ActionRequest'), req1.contractId, 'Execute', { executor: qualify('alice') }),
    /threshold not met/i);

  // 8. Second approval (bob) → quorum met.
  await exercise('bob', tid('ActionRequest'), req1.contractId, 'Approve', { approver: qualify('bob') });
  ok('approved by bob (2/2 — quorum met)');
  const req2 = await findReq('alice');

  // 9. Execute → emits an immutable AuditRecord.
  await exercise('alice', tid('ActionRequest'), req2.contractId, 'Execute', { executor: qualify('alice') });
  ok('executed by alice');

  // 10. The AuditRecord is on the ledger with the right content.
  const audits = await query('alice', tid('AuditRecord'), { application: APP.application });
  const latest = audits.map((a) => a.payload).find((p) => p.reference === APP.reference);
  if (!latest) fail('no AuditRecord with the expected reference was found on the ledger');
  const approvers = (latest.approvals ?? []).map(deQualify).sort();
  if (latest.verb !== APP.verb) fail(`AuditRecord.verb was "${latest.verb}", expected "${APP.verb}"`);
  if (deQualify(latest.executor) !== 'alice') fail(`AuditRecord.executor was "${deQualify(latest.executor)}", expected "alice"`);
  if (approvers.length < 2 || !approvers.includes('alice') || !approvers.includes('bob'))
    fail(`AuditRecord.approvals were [${approvers}], expected to contain alice+bob`);
  ok(`AuditRecord: ${latest.verb} ${APP.reference}, executor=alice, quorum=${approvers.length}/${MEMBERS.length} [${approvers}]`);

  // 11. Persistence: the request is consumed; executed state is re-readable.
  const after = await findReq('alice');
  if (after) fail('the ActionRequest should have been consumed by Execute, but one is still open');
  ok('request consumed; executed state is recoverable by re-reading the ledger');

  console.log(`\n\x1b[32mPASS\x1b[0m — ${passed} on-ledger checks held.\n`);
}

main().catch((e) => fail(e?.stack || e?.message || String(e)));

