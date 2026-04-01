from __future__ import annotations

import os
import re
import shutil

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from lightrag.api.acl_store import ACLStore
from lightrag.api.utils_api import AuthContext, get_combined_auth_dependency
from lightrag.api.workspace_manager import WorkspaceManager

# Must match LIGHTRAG-WORKSPACE header validation in lightrag_server
WORKSPACE_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]{1,64}$")


def _validate_workspace(v: str) -> str:
    if not WORKSPACE_PATTERN.match(v):
        raise ValueError("Workspace must match [a-zA-Z0-9_-]{1,64}")
    return v


router = APIRouter(prefix="/admin", tags=["admin"])


def _get_admins_from_env() -> set[str]:
    raw = os.getenv("AUTH_ADMINS", "") or ""
    admins = {x.strip() for x in raw.split(",") if x.strip()}
    return admins


def make_admin_auth_dependency(api_key: str | None):
    combined_auth = get_combined_auth_dependency(api_key)

    async def _dep(auth: AuthContext = Depends(combined_auth)) -> AuthContext:
        admins = _get_admins_from_env()
        if not admins:
            raise HTTPException(
                status_code=403,
                detail="Admin API disabled: AUTH_ADMINS not configured",
            )
        if not auth.username:
            raise HTTPException(status_code=401, detail="Authentication required")
        if auth.username not in admins:
            raise HTTPException(status_code=403, detail="Admin privileges required")
        return auth

    return _dep


class KBCreateRequest(BaseModel):
    workspace: str = Field(..., min_length=1, max_length=64)
    title: str | None = None
    description: str | None = None

    @field_validator("workspace")
    @classmethod
    def validate_workspace(cls, v: str) -> str:
        return _validate_workspace(v)


class KBResponse(BaseModel):
    workspace: str
    title: str | None
    description: str | None
    created_at: str
    created_by: str | None
    status: str


class GrantRequest(BaseModel):
    username: str = Field(..., min_length=1)
    workspace: str = Field(..., min_length=1, max_length=64)

    @field_validator("workspace")
    @classmethod
    def validate_workspace(cls, v: str) -> str:
        return _validate_workspace(v)


class RevokeRequest(BaseModel):
    username: str = Field(..., min_length=1)
    workspace: str = Field(..., min_length=1, max_length=64)

    @field_validator("workspace")
    @classmethod
    def validate_workspace(cls, v: str) -> str:
        return _validate_workspace(v)


def create_admin_routes(
    *,
    acl_store: ACLStore,
    api_key: str | None = None,
    workspace_manager: WorkspaceManager | None = None,
    working_dir: str | None = None,
):
    admin_auth = make_admin_auth_dependency(api_key)
    combined_auth = get_combined_auth_dependency(api_key)

    @router.get("/kbs", dependencies=[Depends(admin_auth)], response_model=list[KBResponse])
    async def list_kbs():
        return [KBResponse(**kb.__dict__) for kb in acl_store.list_kbs()]

    @router.post("/kbs", dependencies=[Depends(admin_auth)], response_model=KBResponse)
    async def create_kb(body: KBCreateRequest, auth: AuthContext = Depends(admin_auth)):
        acl_store.upsert_kb(
            body.workspace,
            title=body.title,
            description=body.description,
            created_by=auth.username,
            status="active",
        )
        # Auto-grant creator access
        if auth.username:
            acl_store.grant(auth.username, body.workspace, granted_by=auth.username)
        # return the created row
        kbs = {kb.workspace: kb for kb in acl_store.list_kbs()}
        kb = kbs.get(body.workspace)
        if not kb:
            raise HTTPException(status_code=500, detail="Failed to create knowledge base")
        return KBResponse(**kb.__dict__)

    @router.delete("/kbs/{workspace}", dependencies=[Depends(admin_auth)])
    async def delete_kb(workspace: str):
        if not WORKSPACE_PATTERN.match(workspace):
            raise HTTPException(
                status_code=400,
                detail="Invalid workspace. Allowed pattern: [a-zA-Z0-9_-]{1,64}.",
            )
        # Evict RAG from cache and finalize storage
        if workspace_manager:
            await workspace_manager.evict_workspace(workspace)
        # Delete physical data for file-based storage (working_dir/workspace)
        if working_dir:
            ws_dir = os.path.join(working_dir, workspace)
            if os.path.isdir(ws_dir):
                try:
                    shutil.rmtree(ws_dir)
                except OSError:
                    pass  # Best-effort; remote backends may not use dirs
        acl_store.delete_kb(workspace)
        return {"status": "success"}

    @router.get("/acl", dependencies=[Depends(admin_auth)])
    async def list_acl(workspace: str = Query(..., min_length=1, max_length=64)):
        if not WORKSPACE_PATTERN.match(workspace):
            raise HTTPException(
                status_code=400,
                detail="Invalid workspace. Allowed pattern: [a-zA-Z0-9_-]{1,64}.",
            )
        return {"workspace": workspace, "users": acl_store.list_workspace_users(workspace)}

    @router.post("/acl/grant", dependencies=[Depends(admin_auth)])
    async def grant_access(body: GrantRequest, auth: AuthContext = Depends(admin_auth)):
        acl_store.ensure_kbs_exist([body.workspace])
        acl_store.grant(body.username, body.workspace, granted_by=auth.username)
        return {"status": "success"}

    @router.post("/acl/revoke", dependencies=[Depends(admin_auth)])
    async def revoke_access(body: RevokeRequest):
        acl_store.revoke(body.username, body.workspace)
        return {"status": "success"}

    @router.get("/me/kbs", dependencies=[Depends(combined_auth)])
    async def my_kbs(auth: AuthContext = Depends(combined_auth)):
        if not auth.username:
            raise HTTPException(status_code=401, detail="Authentication required")
        workspaces = acl_store.list_user_workspaces(auth.username)
        return {"username": auth.username, "workspaces": workspaces}

    return router

