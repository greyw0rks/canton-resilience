# LocalNet

Run the full Canton Resilience threshold workflow against a real Canton ledger
on your machine. This replaces the built-in in-memory ledger with live Daml
contracts: approvals and executions change on-ledger contract state and survive
a browser refresh.

> **SDK note.** This project targets the freely-distributed **Daml 2.10.6** SDK,
> whose participant exposes the **HTTP JSON API v1**. (Daml 3.x / Canton 3.x with
> the JSON Ledger API v2 is distributed only through Digital Asset's Canton
> Network channels and is not publicly installable.) The app talks to the ledger
> through the server route `app/api/ledger/route.ts`, so the browser never holds
> a token and there is no CORS to configure.

## 1. One-time toolchain install

Requires a JDK 11+ and the Daml SDK.

```bash
# JDK (Amazon Corretto 17, no root needed) — skip if you already have Java 11+
mkdir -p ~/.local/jdk
curl -sL https://corretto.aws/downloads/latest/amazon-corretto-17-x64-linux-jdk.tar.gz \
  | tar -xz -C ~/.local/jdk
export JAVA_HOME="$(ls -d ~/.local/jdk/*/ | head -1)"
export PATH="$JAVA_HOME/bin:$PATH"
java -version   # expect 17.x

# Daml SDK 2.10.6 (installs to ~/.daml)
curl -sSL https://get.daml.com | sh -s 2.10.6
export PATH="$HOME/.daml/bin:$PATH"
daml version    # expect 2.10.6
```

Add the two `export PATH=...` lines to your shell profile so new shells find
`java` and `daml`.

## 2. Bring up the ledger

From the repo root:

```bash
npm run ledger:up
```

This runs `scripts/localnet.sh`, which:

1. `daml build` → `daml/.daml/dist/canton-resilience-0.1.0.dar`
2. starts a Canton sandbox on `localhost:6865` and uploads the DAR,
3. runs `daml/Init.daml` (`Init:initialize`) to allocate the parties
   (Alice/Bob/Carol/Dave/Erin + Operator) and create one `Policy` per
   reference application,
4. starts the HTTP JSON API v1 on `localhost:7575` with `--allow-insecure-tokens`,
5. writes `.env.local` with `NEXT_PUBLIC_LEDGER_MODE=json-api`, `LEDGER_URL`,
   and `LEDGER_PARTY_MAP` (UI slug → allocated Canton party).

Stop everything with `npm run ledger:stop`.

## 3. Run the app against the ledger

```bash
npm run dev      # http://localhost:3000
```

The header status now reads **json-api**. Every approval/execute is a real
`ActionRequest.Approve` / `ActionRequest.Execute` choice on the ledger.

## 4. Verify the threshold workflow

1. Approve as **Alice** → progress shows **1 / 2**, execution stays blocked.
2. Approve as **Bob** → **2 / 2**, execution unlocks.
3. **Execute** → creates an `AuditRecord` contract on the ledger.
4. **Hard-refresh the browser** → the approvals/executed state reload from the
   ledger, proving state is not local UI state.
5. Negative checks (surface as readable errors, not `Error: undefined`):
   approving as a non-member and approving twice are both rejected by the ledger.

## 5. Run the Daml acceptance tests

```bash
cd daml && daml test
```

Covers: 2-of-3 executes; 1-of-3 cannot; non-member cannot approve/request; no
double approval; no double execution; invalid threshold rejected; empty/duplicate
member list rejected; policy owner cannot bypass the threshold. See `daml/Test.daml`.

## Troubleshooting

- **`daml: command not found`** — re-run the `export PATH="$HOME/.daml/bin:$PATH"` line.
- **JSON API rejects the token** — the sandbox must be started (it is, by the
  script) and the JSON API must run with `--allow-insecure-tokens`. Token minting
  lives in one place: `mintToken()` in `app/api/ledger/route.ts`.
- **`No Policy on the ledger for "…"`** — the Init script didn't run; re-run
  `npm run ledger:up`.
- **Ports busy** — stop a previous run with `npm run ledger:stop` (frees 6865/7575).
