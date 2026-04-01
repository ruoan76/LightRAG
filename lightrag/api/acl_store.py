from __future__ import annotations

import os
import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class KnowledgeBase:
    workspace: str
    title: str | None
    description: str | None
    created_at: str
    created_by: str | None
    status: str


class ACLStore:
    """SQLite-backed simple ACL store for workspace access (deny-by-default).

    This store is intentionally minimal (no groups/roles). It supports:
    - knowledge_bases metadata (optional)
    - kb_access mapping: username -> workspace
    """

    def __init__(self, db_path: str):
        self.db_path = str(db_path)
        self._conn: Optional[sqlite3.Connection] = None
        self._lock = threading.RLock()

    def initialize(self) -> None:
        Path(os.path.dirname(self.db_path)).mkdir(parents=True, exist_ok=True)
        with self._lock:
            if self._conn is None:
                self._conn = sqlite3.connect(self.db_path, check_same_thread=False)
                self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL;")
            self._conn.execute("PRAGMA foreign_keys=ON;")
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS knowledge_bases (
                    workspace TEXT PRIMARY KEY,
                    title TEXT,
                    description TEXT,
                    created_at TEXT NOT NULL,
                    created_by TEXT,
                    status TEXT NOT NULL DEFAULT 'active'
                );
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS kb_access (
                    username TEXT NOT NULL,
                    workspace TEXT NOT NULL,
                    granted_at TEXT NOT NULL,
                    granted_by TEXT,
                    PRIMARY KEY (username, workspace),
                    FOREIGN KEY (workspace) REFERENCES knowledge_bases(workspace) ON DELETE CASCADE
                );
                """
            )
            self._conn.commit()

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            raise RuntimeError("ACLStore not initialized")
        return self._conn

    def list_kbs(self) -> list[KnowledgeBase]:
        with self._lock:
            rows = self.conn.execute(
                """
                SELECT workspace, title, description, created_at, created_by, status
                FROM knowledge_bases
                ORDER BY workspace ASC
                """
            ).fetchall()
            return [
                KnowledgeBase(
                    workspace=r["workspace"],
                    title=r["title"],
                    description=r["description"],
                    created_at=r["created_at"],
                    created_by=r["created_by"],
                    status=r["status"],
                )
                for r in rows
            ]

    def upsert_kb(
        self,
        workspace: str,
        *,
        title: str | None = None,
        description: str | None = None,
        created_by: str | None = None,
        status: str = "active",
    ) -> None:
        now = _utc_now_iso()
        with self._lock:
            self.conn.execute(
                """
                INSERT INTO knowledge_bases (workspace, title, description, created_at, created_by, status)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(workspace) DO UPDATE SET
                    title=excluded.title,
                    description=excluded.description,
                    status=excluded.status
                """,
                (workspace, title, description, now, created_by, status),
            )
            self.conn.commit()

    def delete_kb(self, workspace: str) -> None:
        with self._lock:
            self.conn.execute("DELETE FROM knowledge_bases WHERE workspace = ?", (workspace,))
            self.conn.commit()

    def grant(self, username: str, workspace: str, granted_by: str | None = None) -> None:
        now = _utc_now_iso()
        with self._lock:
            self.conn.execute(
                """
                INSERT OR REPLACE INTO kb_access (username, workspace, granted_at, granted_by)
                VALUES (?, ?, ?, ?)
                """,
                (username, workspace, now, granted_by),
            )
            self.conn.commit()

    def revoke(self, username: str, workspace: str) -> None:
        with self._lock:
            self.conn.execute(
                "DELETE FROM kb_access WHERE username = ? AND workspace = ?",
                (username, workspace),
            )
            self.conn.commit()

    def list_workspace_users(self, workspace: str) -> list[dict]:
        with self._lock:
            rows = self.conn.execute(
                """
                SELECT username, granted_at, granted_by
                FROM kb_access
                WHERE workspace = ?
                ORDER BY username ASC
                """,
                (workspace,),
            ).fetchall()
            return [
                {
                    "username": r["username"],
                    "granted_at": r["granted_at"],
                    "granted_by": r["granted_by"],
                }
                for r in rows
            ]

    def list_user_workspaces(self, username: str) -> list[str]:
        with self._lock:
            rows = self.conn.execute(
                """
                SELECT workspace
                FROM kb_access
                WHERE username = ?
                ORDER BY workspace ASC
                """,
                (username,),
            ).fetchall()
            return [r["workspace"] for r in rows]

    def is_allowed(self, username: str, workspace: str) -> bool:
        # deny-by-default: must exist in kb_access
        with self._lock:
            row = self.conn.execute(
                """
                SELECT 1
                FROM kb_access
                WHERE username = ? AND workspace = ?
                LIMIT 1
                """,
                (username, workspace),
            ).fetchone()
            return row is not None

    def ensure_kbs_exist(self, workspaces: Iterable[str]) -> None:
        """Ensure knowledge_bases row exists for each workspace (for legacy discovery/import)."""
        with self._lock:
            for ws in workspaces:
                self.conn.execute(
                    """
                    INSERT OR IGNORE INTO knowledge_bases (workspace, title, description, created_at, created_by, status)
                    VALUES (?, NULL, NULL, ?, NULL, 'active')
                    """,
                    (ws, _utc_now_iso()),
                )
            self.conn.commit()

    def close(self) -> None:
        """Close the database connection. Idempotent."""
        with self._lock:
            if self._conn is not None:
                self._conn.close()
                self._conn = None

