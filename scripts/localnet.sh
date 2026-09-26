#!/usr/bin/env bash
#
# Canton Resilience — LocalNet bring-up (Daml 2.x).
#
# Builds the DAR, starts a Canton sandbox + HTTP JSON API v1, allocates the demo
# parties, creates one Policy per reference application, and writes .env.local so
# the Next.js app (via app/api/ledger/route.ts) talks to the live ledger.
#
# Prereqs: a JDK on PATH (or JAVA_HOME set) and the Daml SDK (`daml`) installed.
# See docs/LOCALNET.md for the one-time toolchain install.
#
# Usage:  ./scripts/localnet.sh          # from the repo root
# Stop:   ./scripts/localnet.sh stop
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DAML_DIR="$ROOT/daml"
DAR="$DAML_DIR/.daml/dist/canton-resilience-0.1.0.dar"
LEDGER_PORT=6865
JSON_PORT=7575
INIT_OUT="$ROOT/.localnet-init.json"
PIDS_FILE="$ROOT/.localnet-pids"

# Make a locally-installed JDK visible if JAVA_HOME is not already set.
if [ -z "${JAVA_HOME:-}" ]; then
  CAND="$(ls -d "$HOME"/.local/jdk/*/ 2>/dev/null | head -1 || true)"
  if [ -n "$CAND" ]; then export JAVA_HOME="${CAND%/}"; export PATH="$JAVA_HOME/bin:$PATH"; fi
fi
export PATH="$HOME/.daml/bin:$PATH"

stop() {
  echo "Stopping LocalNet..."
  [ -f "$PIDS_FILE" ] && while read -r pid; do kill "$pid" 2>/dev/null || true; done < "$PIDS_FILE"
  rm -f "$PIDS_FILE"
  exit 0
}
[ "${1:-}" = "stop" ] && stop

command -v daml >/dev/null || { echo "ERROR: 'daml' not on PATH — see docs/LOCALNET.md"; exit 1; }
command -v java >/dev/null || { echo "ERROR: no JDK on PATH / JAVA_HOME unset"; exit 1; }

echo "==> daml build"
( cd "$DAML_DIR" && daml build )

echo "==> starting sandbox on :$LEDGER_PORT"
( cd "$DAML_DIR" && daml sandbox --port "$LEDGER_PORT" ) &
echo $! > "$PIDS_FILE"

echo "==> waiting for the ledger API..."
for _ in $(seq 1 60); do
  ( cd "$DAML_DIR" && daml ledger upload-dar --host localhost --port "$LEDGER_PORT" "$DAR" ) >/dev/null 2>&1 && break
  sleep 2
done

echo "==> allocating parties + creating policies (Init:initialize)"
( cd "$DAML_DIR" && daml script \
    --dar "$DAR" \
    --script-name Init:initialize \
    --ledger-host localhost --ledger-port "$LEDGER_PORT" \
    --output-file "$INIT_OUT" )

echo "==> starting JSON API v1 on :$JSON_PORT"
daml json-api \
  --ledger-host localhost --ledger-port "$LEDGER_PORT" \
  --http-port "$JSON_PORT" --allow-insecure-tokens &
echo $! >> "$PIDS_FILE"

echo "==> writing .env.local"
PARTY_MAP="$(node -e '
  const j = require(process.argv[1]);
  const map = Object.fromEntries((j.parties || []).map(p => [p.slug, p.party]));
  process.stdout.write(JSON.stringify(map));
' "$INIT_OUT")"

cat > "$ROOT/.env.local" <<EOF
# Written by scripts/localnet.sh — points the app at the live LocalNet ledger.
NEXT_PUBLIC_LEDGER_MODE=json-api
LEDGER_URL=http://localhost:$JSON_PORT
LEDGER_APP_ID=canton-resilience
LEDGER_PARTY_MAP=$PARTY_MAP
EOF

echo ""
echo "LocalNet is up."
echo "  Ledger gRPC : localhost:$LEDGER_PORT"
echo "  JSON API v1 : http://localhost:$JSON_PORT"
echo "  Parties     : $PARTY_MAP"
echo ""
echo "Now run:  npm run dev   (then open http://localhost:3000)"
echo "Stop:     ./scripts/localnet.sh stop"
