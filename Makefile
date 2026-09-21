.PHONY: setup backend-dev frontend-dev test test-backend test-guard test-contracts test-frontend build compose-config compose-up compose-down

setup:
	python3 -m venv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install -e ./guard-engine -e './backend[dev]'
	cd frontend && npm ci
	cd blockchain && npm ci

backend-dev:
	PYTHONPATH=guard-engine/src:backend .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev:
	cd frontend && npm run dev

test: test-guard test-backend test-contracts test-frontend

test-guard:
	.venv/bin/pytest guard-engine/tests

test-backend:
	.venv/bin/pytest backend/tests

test-contracts:
	cd blockchain && npm test

test-frontend:
	cd frontend && npm run build

build:
	cd frontend && npm run build
	cd blockchain && npm run compile

compose-config:
	docker compose config

compose-up:
	docker compose up -d --build

compose-down:
	docker compose down
