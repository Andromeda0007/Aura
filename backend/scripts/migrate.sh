#!/usr/bin/env bash
# One-shot "migrate": wipe the dev DB, apply all migrations, and seed the full
# demo structure (4 batches -> 4 departments each -> Sem 1-8 -> courses in
# Sem 2/4/6/8 -> Deep Learning units). DESTRUCTIVE — drops the public schema.
#
#   cd backend && bash scripts/migrate.sh
set -euo pipefail
cd "$(dirname "$0")/.."   # -> backend/

echo "==> Resetting schema (DROP + CREATE public)…"
docker exec aura-db psql -U aura -d aura_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "==> Applying migrations…"
.venv/bin/alembic upgrade head

echo "==> Seeding demo data + admin…"
.venv/bin/python scripts/seed_demo.py

echo "==> Done."
