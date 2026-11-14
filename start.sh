#!/usr/bin/env bash
# One-command start: installs deps if needed, builds the UI, serves everything on :8000.
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q -r backend/requirements.txt
fi
if [ ! -d frontend/node_modules ]; then (cd frontend && npm install --silent); fi
(cd frontend && npm run build --silent)
cd backend && exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
