.PHONY: dev-up dev-down db-migrate db-reset db-reset-sqlx db-new backend-dev frontend-dev

# Start PostgreSQL
dev-up:
	docker compose up -d
	@echo "PostgreSQL started on :5432"

# Stop PostgreSQL
dev-down:
	docker compose down

# Run pending SQLx migrations
db-migrate:
	cd backend && sqlx migrate run

# Rollback last migration
db-revert:
	cd backend && sqlx migrate revert

# Create new SQLx migration (usage: make db-new name=create_teams)
db-new:
	cd backend && sqlx migrate add $(name)

# Reset DB (drop + recreate + migrate)
db-reset:
	docker compose down -v
	docker compose up -d
	@sleep 2
	cd backend && sqlx migrate run

# Start Rust backend (dev)
backend-dev:
	cd backend && cargo watch -x run

# Start frontend (dev)
frontend-dev:
	cd frontend && npm run dev
