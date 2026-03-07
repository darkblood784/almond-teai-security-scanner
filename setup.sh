#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  AI Code Security Scanner — One-click setup
# ─────────────────────────────────────────────────────────────────────
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   AI Code Security Scanner — Setup       ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# ── 1. Node.js ──────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  warn "Node.js not found. Installing via nvm…"
  if ! command -v curl &>/dev/null; then err "curl not found. Please install Node.js 18+ manually."; fi

  # Install nvm
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
  log "Node.js $(node --version) installed"
else
  log "Node.js $(node --version) found"
fi

# ── 2. Install dependencies ──────────────────────────────────────────
log "Installing dependencies…"
npm install

# ── 3. Environment ───────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  warn "Created .env from .env.example — add your ANTHROPIC_API_KEY for AI-enhanced analysis."
else
  log ".env already exists"
fi

# ── 4. Database ──────────────────────────────────────────────────────
log "Generating Prisma client…"
npx prisma generate

log "Pushing schema to SQLite database…"
npx prisma db push

# ── 5. Done ──────────────────────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   Setup complete!                        ║"
echo "  ║                                          ║"
echo "  ║   Run:  npm run dev                      ║"
echo "  ║   Open: http://localhost:3000            ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""
