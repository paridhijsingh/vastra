"""Create or refresh the synthetic demo account from DEMO_EMAIL / DEMO_PASSWORD.

Credentials are read from the environment only. This script does not print them.
Pytest does not run this script.

Usage:
  python scripts/seed_demo.py
  python scripts/seed_demo.py --api-url https://vastra-api-c5gx.onrender.com
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

from vastra.config import clear_settings_cache, get_settings
from vastra.db import get_session_factory, init_db, reset_db_state
from vastra.demo import (
    DEMO_PROFILE,
    DEMO_WARDROBE_ITEMS,
    DemoNotConfiguredError,
    demo_credentials,
    seed_demo_account,
)


def _summarize(username: str) -> str:
    available = sum(1 for item in DEMO_WARDROBE_ITEMS if item["availability"] == "available")
    laundry = sum(1 for item in DEMO_WARDROBE_ITEMS if item["availability"] == "in_laundry")
    return (
        f"Seeded demo username {username!r} with "
        f"{len(DEMO_WARDROBE_ITEMS)} synthetic items "
        f"({available} available, {laundry} in laundry)."
    )


def _api_json(
    base: str,
    method: str,
    path: str,
    *,
    token: str | None = None,
    payload: object | None = None,
) -> tuple[int, object]:
    request = urllib.request.Request(
        f"{base.rstrip('/')}{path}",
        method=method,
        data=None if payload is None else json.dumps(payload).encode("utf-8"),
        headers={"Accept": "application/json"},
    )
    if payload is not None:
        request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
            body: object = json.loads(raw.decode("utf-8")) if raw else None
            return response.status, body
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            body = json.loads(raw.decode("utf-8")) if raw else None
        except json.JSONDecodeError:
            body = None
        return exc.code, body


def seed_via_api(base_url: str, username: str, password: str) -> None:
    """Register/login through the public API so a hosted SQLite disk can be seeded."""
    status, _body = _api_json(
        base_url,
        "POST",
        "/auth/register",
        payload={"username": username, "password": password},
    )
    if status not in {201, 409}:
        raise SystemExit(f"Demo register failed with HTTP {status}.")
    status, login_body = _api_json(
        base_url,
        "POST",
        "/auth/login",
        payload={"username": username, "password": password},
    )
    if status != 200 or not isinstance(login_body, dict):
        raise SystemExit("Demo login failed. Check DEMO_EMAIL / DEMO_PASSWORD.")
    token = login_body.get("access_token")
    if not isinstance(token, str) or not token:
        raise SystemExit("Demo login did not return an access token.")
    status, _profile = _api_json(
        base_url, "PUT", "/profile", token=token, payload=DEMO_PROFILE
    )
    if status != 200:
        raise SystemExit(f"Demo profile save failed with HTTP {status}.")
    status, items = _api_json(base_url, "GET", "/wardrobe", token=token)
    if status != 200 or not isinstance(items, list):
        raise SystemExit("Could not list the demo wardrobe.")
    for item in items:
        if isinstance(item, dict) and isinstance(item.get("id"), str):
            _api_json(base_url, "DELETE", f"/wardrobe/{item['id']}", token=token)
    for spec in DEMO_WARDROBE_ITEMS:
        status, _created = _api_json(base_url, "POST", "/wardrobe", token=token, payload=spec)
        if status != 201:
            raise SystemExit(f"Demo item {spec['name']!r} failed with HTTP {status}.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed the synthetic Vastra demo account.")
    parser.add_argument(
        "--api-url",
        help="Seed a running API (for hosted SQLite) instead of the local DATABASE_URL.",
    )
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")
    clear_settings_cache()
    try:
        username, password = demo_credentials(get_settings())
    except DemoNotConfiguredError as exc:
        print(exc.message, file=sys.stderr)
        print(
            "Set DEMO_EMAIL and DEMO_PASSWORD in .env (DEMO_EMAIL is the demo username).",
            file=sys.stderr,
        )
        return 1

    if args.api_url:
        seed_via_api(args.api_url, username, password)
        print(_summarize(username))
        return 0

    reset_db_state()
    init_db()
    session = get_session_factory()()
    try:
        seed_demo_account(session, username, password)
        session.commit()
        print(_summarize(username))
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        reset_db_state()
        clear_settings_cache()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
