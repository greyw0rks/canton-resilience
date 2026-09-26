# Architecture

```text
Grofty Wallet
     |  sign / transact
     v
Canton Resilience (this project)
     |  +-- Policy Engine      : who may act, how many must approve
     |  +-- Approval Workflow  : per-party approvals, quorum
     |  +-- Audit Engine       : ordered, traceable record of every decision
     v
Daml Application Contracts
     |  Policy / ActionRequest (+ Approve/Execute choices) / AuditRecord
     v
BitSafe Decentralization Manager
     |  +-- Decentralized Party
     |  +-- Operator A / B / C (...)
     v
Canton Network (settlement · privacy)
```

## Reusable, not treasury-specific

The control layer is application-agnostic. Every protected application is the same shape —
parties, an approval threshold, a set of hosting operators, and one generic privileged action
(`verb` + `target` + `detail`). Treasury, token administration, trading administration and
protocol governance are all instances of that shape, defined in `lib/applications.ts`.

## Code ↔ contract mapping

`lib/engine.ts` keeps the policy/hosting/audit logic as pure functions so it maps directly onto
the Daml choices it will eventually call:

| UI concept (`lib/engine.ts`) | Daml equivalent (`daml/Main.daml`)          |
| ---------------------------- | ------------------------------------------- |
| `approvalsMet`               | `Execute` guard: `length approvals >= threshold` |
| approval toggle              | `ActionRequest.Approve`                     |
| execute action               | `ActionRequest.Execute` → `AuditRecord`     |
| audit trail                  | `AuditRecord` contract                      |
| `isAvailable` / hosting      | Decentralization Manager (out of contract)  |

## Design rule

Canton Resilience does not recreate the Decentralization Manager. It owns application policy and
workflow. The Decentralization Manager owns the decentralized-party / operator infrastructure.

## Failure test

The demo must prove two independent properties:

- **Shared control** — a protected action does not execute until the configured approval
  threshold is reached.
- **Distributed hosting** — taking one configured hosting operator offline does not make the
  application unavailable while the hosting threshold still permits operation.

These are independent: approvals govern *whether* an action is authorized; hosting governs
*whether the application is reachable to execute it*. The audit trail records both.
