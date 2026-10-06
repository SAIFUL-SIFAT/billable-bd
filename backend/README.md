# backend — Billable BD (Django API)

Django backend for Billable BD, an invoicing and time-tracking app for freelancers working with multiple currencies.

Managed with [uv](https://docs.astral.sh/uv/). Python 3.14+, MySQL 8.0 via Docker.

## Tech stack

| Concern | Choice |
|---|---|
| **Framework** | Django 6.1 + Django REST Framework |
| **Database** | MySQL 8.0 |
| **Auth** | SimpleJWT (email-based custom user) |
| **Testing** | pytest + pytest-django |
| **Type checking** | Pyright + django-stubs |
| **Env config** | django-environ |

## What's here

```text
backend/
├── pyproject.toml      # dependencies + tool config (managed by uv)
├── uv.lock             # exact pinned versions — commit this
├── manage.py
├── .env.example        # copy to .env
├── config/
│   └── settings/       # base.py, dev.py, prod.py, test.py
└── apps/
    ├── accounts/       # custom User (email login) + Profile
    ├── clients/        # Client, Project (hourly/fixed CHECK constraints)
    ├── core/           # shared constants, utils, abstract models
    ├── billing/        # time entries, invoices, payments
    ├── reports/        # dashboard + fiscal-year APIs
    └── notifications/  # email + in-app notifications
```

Each app follows Django's standard layout (`models.py`, `views.py`, `admin.py`, `apps.py`, `tests`, `migrations/`, `__init__.py`).

## Quick start

**Prerequisite:** install [uv](https://docs.astral.sh/uv/getting-started/installation/) and Docker.

```bash
# 1. start MySQL (from the repo root)
docker-compose up -d

# 2. install Python + dependencies into .venv (reads pyproject.toml / uv.lock)
cd backend
uv sync

# 3. configure environment
cp .env.example .env
# edit if needed

# 4. create tables
uv run python manage.py migrate

# 5. create an admin (log in with EMAIL, not username)
uv run python manage.py createsuperuser

# 6. run
uv run python manage.py runserver
```

API: `http://127.0.0.1:8000/` — Admin: `http://127.0.0.1:8000/admin`

No need to create or activate a virtualenv: `uv run` uses the project's `.venv` automatically.

> **mysqlclient build errors?** It needs system libraries.
> - **macOS:** `brew install mysql-client pkg-config`
> - **Ubuntu/Debian:** `sudo apt install libmysqlclient-dev pkg-config build-essential`
> - **Windows:** install the Visual C++ Build Tools, or use a prebuilt wheel.

## Environment variables

`.env` in `backend/`:
```env
DEBUG=True
SECRET_KEY="replace-this-with-a-local-secret-key"
```

## Migrations

```bash
uv run python manage.py makemigrations  # after editing a models.py
uv run python manage.py migrate         # apply to the database
```
Commit the generated files in each app's `migrations/` folder.

## Testing

```bash
uv run pytest               # full suite
uv run pytest -v            # verbose
uv run pytest apps/clients/ # one app
```

## Type checking

```bash
uv run pyright
```

Pyright + django-stubs are enforced. If a Django subclass (e.g. ModelAdmin) overrides a base signature, use `# type: ignore[assignment]` sparingly and keep everything else fully typed.

## Managing dependencies

```bash
uv add <package>        # runtime dependency
uv add --dev <package>  # dev-only (pytest, pyright, stubs)
uv remove <package>
uv sync                 # re-sync .venv after pulling changes
```
This keeps `pyproject.toml` and `uv.lock` in sync — no manual `requirements.txt` editing.

## Migrating from requirements/*.txt (one-time)

```bash
uv init --bare
uv add -r requirements/base.txt
uv add --dev -r requirements/dev.txt
```
Then delete `requirements/` once `uv sync` works on a clean clone.

## Design notes

- Apps are split by domain, not by layer. Each owns its models, views, admin, and migrations.
- Custom `accounts.User` uses email as the login field. It must be set via `AUTH_USER_MODEL` before the first migration.
- DB-level `CHECK` constraints on `Project` guarantee hourly projects have a rate and fixed projects have a price, regardless of which code path writes the row.
- Split settings (base/dev/prod/test) keep local, CI, and production config separate.
- `uv.lock` is committed so everyone (and CI) installs identical versions.

## Suggested commit flow

```bash
git add pyproject.toml uv.lock apps/ config/ .env.example README.md
git commit -m "chore: switch to uv for dependency management"
```
*Make sure `.env`, `.venv/`, and `__pycache__/` are in `.gitignore`.*
