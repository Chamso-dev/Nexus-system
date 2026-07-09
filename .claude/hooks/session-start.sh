#!/usr/bin/env bash
# =============================================================================
# SessionStart hook for Claude Code on the web.
# Ensures the project is ready to build, test and lint in a fresh session:
#   - installs dependencies (if missing)
#   - generates the Prisma client (required for typecheck/build)
# Runs quietly and never fails the session (best-effort setup).
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0

echo "[session-start] Preparing Nexus workspace…"

if [ ! -d node_modules ]; then
  echo "[session-start] Installing dependencies (npm ci)…"
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund || true
fi

# Prisma client is generated code that typecheck/build/tests depend on.
if [ ! -d node_modules/.prisma/client ]; then
  echo "[session-start] Generating Prisma client…"
  npx prisma generate || true
fi

echo "[session-start] Ready. Try: npm run typecheck && npm test && npm run build"
exit 0
