# Canton Resilience — Submission

**One sentence.** A reusable *decentralized control layer* for Canton
applications — policy, approval, resilience and audit — proven on a live ledger
with an institutional treasury as the reference app.

## What it proves

A critical Canton application action requires **shared authorization** (a k-of-n
approval quorum enforced on-ledger) and stays **operational when a hosting
operator goes offline** (distributed hosting), with every decision captured in an
immutable **audit** trail.

## The four pillars and where each lives

| Pillar | Where it is enforced | Status |
| --- | --- | --- |
| **Policy** | `Policy` template — members, threshold, well-formedness `ensure` | ✅ on-ledger |
| **Approval** | `ActionRequest.Approve` / `Execute`, `length approvals >= threshold` | ✅ on-ledger |
| **Audit** | `AuditRecord` template; UI reads it back via `/api/ledger` `audit` | ✅ on-ledger |
| **Resilience (hosting)** | Decentralization Manager / operator topology | 🔌 seam (see below) |

## Verified end-to-end (2026-09-29, Daml SDK 2.10.6)

- `daml build` + `daml test` — every acceptance case green (`daml/Test.daml`).
- `npm run ledger:up` — sandbox + HTTP JSON API v1, parties allocated, one
  `Policy` per reference app, `.env.local` written.
- Full flow through the real `/api/ledger` route on the live ledger:
  request → approve → approve → **execute → AuditRecord**, with under-threshold
  execute, double-approve and non-member actions rejected **on-ledger** and shown
  as readable messages. See `docs/LOCALNET.md`.

## Reusable, not treasury-specific

One generic contract set (`verb` + `target` + `detail`) protects four reference
applications — Treasury (2/3), Token Administration (3/4), Trading Administration
(2/3), Protocol Governance (3/5) — defined in `lib/applications.ts`. Switching
apps in the console switches the on-ledger `Policy` it drives.

## Honest seams (intentionally not faked)

These require infrastructure that is not publicly installable; they are wired as
clean seams rather than mocked as "done":

- **Grofty signing** — `lib/wallet.ts` defines the `WalletAdapter` seam. There is
  no public Grofty SDK; a real adapter would wrap it (or the published
  `@canton-network/wallet-sdk`). The demo uses `DemoWallet` (`real = false`), and
  the ledger command is authorized server-side by the acting party's dev token.
- **BitSafe Decentralization Manager / multi-operator hosting** — the hosting
  layer (Decentralized Party, operator A/B/C…) lives *outside* the business
  contracts by design (`docs/ARCHITECTURE.md`). Against a single LocalNet
  participant the operator/node-failure view is a faithful UI simulation; the real
  topology is a DevNet/MainNet deployment concern.

## Run it

```bash
# one-time toolchain — see docs/LOCALNET.md §1 (JDK + Daml 2.10.6)
npm install
npm run ledger:up   # live Canton ledger + .env.local
npm run dev         # http://localhost:3000, header shows "json-api"
```

Without `.env.local` the app runs the built-in in-memory ledger, which mirrors
the exact Daml guards — useful for a zero-dependency demo.
