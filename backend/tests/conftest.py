import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture()
def client(tmp_path):
    """API client backed by a throwaway SQLite file (dependency override, no global state)."""
    from fastapi.testclient import TestClient
    from sqlmodel import Session

    from app.main import create_app
    from app.persistence.db import get_session, make_engine

    eng = make_engine(f"sqlite:///{tmp_path / 't.db'}")

    def _session():
        with Session(eng) as s:
            yield s

    app = create_app()
    app.dependency_overrides[get_session] = _session
    with TestClient(app) as c:
        yield c
