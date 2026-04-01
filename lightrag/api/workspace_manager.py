from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Callable

from lightrag import LightRAG


@dataclass
class _RAGEntry:
    rag: LightRAG
    last_used_ts: float
    init_lock: asyncio.Lock
    initialized: bool = False


class WorkspaceManager:
    """Manage per-workspace LightRAG instances with lazy initialization."""

    def __init__(
        self,
        rag_factory: Callable[[str], LightRAG],
        *,
        max_cached: int = 10,
        idle_finalize_seconds: int | None = None,
    ):
        self._rag_factory: Callable[[str], LightRAG] = rag_factory
        self._max_cached: int = max_cached
        self._idle_finalize_seconds: int | None = idle_finalize_seconds
        self._entries: dict[str, _RAGEntry] = {}
        self._guard: asyncio.Lock = asyncio.Lock()

    async def get_rag(self, workspace: str) -> LightRAG:
        now = time.time()
        async with self._guard:
            entry = self._entries.get(workspace)
            if entry is None:
                rag = self._rag_factory(workspace)
                entry = _RAGEntry(
                    rag=rag,
                    last_used_ts=now,
                    init_lock=asyncio.Lock(),
                    initialized=False,
                )
                self._entries[workspace] = entry
            entry.last_used_ts = now

            # Evict if too many cached (best-effort; evict least recently used)
            if self._max_cached and len(self._entries) > self._max_cached:
                await self._evict_lru_locked()

        async with entry.init_lock:
            if not entry.initialized:
                await entry.rag.initialize_storages()
                await entry.rag.check_and_migrate_data()
                entry.initialized = True
        return entry.rag

    async def _evict_lru_locked(self) -> None:
        # Only called while holding self._guard
        if len(self._entries) <= self._max_cached:
            return
        # pick victim: oldest last_used_ts, but avoid evicting entries that are currently initializing
        victim_ws = None
        victim_ts = None
        for ws, entry in self._entries.items():
            if entry.init_lock.locked():
                continue
            if victim_ts is None or entry.last_used_ts < victim_ts:
                victim_ts = entry.last_used_ts
                victim_ws = ws

        if victim_ws is None:
            return

        victim = self._entries.pop(victim_ws, None)
        if victim is None:
            return
        try:
            if victim.initialized:
                await victim.rag.finalize_storages()
        except Exception:
            # eviction should never fail request path
            pass

    async def evict_workspace(self, workspace: str) -> None:
        """Evict a workspace from cache: finalize storage and remove entry. Used before delete."""
        async with self._guard:
            entry = self._entries.pop(workspace, None)
        if entry is None:
            return
        try:
            if entry.initialized:
                async with entry.init_lock:
                    await entry.rag.finalize_storages()
        except Exception:
            pass

    async def maybe_finalize_idle(self) -> None:
        if not self._idle_finalize_seconds:
            return
        now = time.time()
        cutoff = now - self._idle_finalize_seconds
        async with self._guard:
            idle = [
                (ws, e)
                for ws, e in self._entries.items()
                if e.initialized and (e.last_used_ts < cutoff) and not e.init_lock.locked()
            ]
            for ws, entry in idle:
                _ = self._entries.pop(ws, None)
                try:
                    await entry.rag.finalize_storages()
                except Exception:
                    pass

