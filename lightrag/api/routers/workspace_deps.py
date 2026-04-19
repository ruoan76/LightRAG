from __future__ import annotations

from fastapi import Depends, HTTPException, Request

from lightrag.api.acl_store import ACLStore
from lightrag.api.utils_api import AuthContext, get_combined_auth_dependency
from lightrag.api.workspace_manager import WorkspaceManager

# Stable JSON `detail.code` for WebUI 403 reconciliation (see lightrag_webui axios interceptor).
WORKSPACE_ACCESS_DENIED_CODE = "workspace_access_denied"


def get_workspace_from_state(request: Request) -> str:
    ws = getattr(request.state, "workspace", None)
    if ws is None:
        raise HTTPException(status_code=500, detail="Workspace context not initialized")
    return ws


def make_workspace_auth_dependency(
    api_key: str | None,
    *,
    acl_store: ACLStore,
):
    combined_auth = get_combined_auth_dependency(api_key)

    async def _dep(request: Request, auth: AuthContext = Depends(combined_auth)) -> AuthContext:
        workspace = get_workspace_from_state(request)
        username = auth.username
        if not username:
            raise HTTPException(status_code=401, detail="Authentication required")
        if not acl_store.is_allowed(username, workspace):
            raise HTTPException(
                status_code=403,
                detail={
                    "code": WORKSPACE_ACCESS_DENIED_CODE,
                    "message": "No access to this knowledge base workspace",
                },
            )
        return auth

    return _dep


def make_workspace_rag_dependency(
    *,
    workspace_manager: WorkspaceManager,
):
    async def _rag_dep(request: Request):
        workspace = get_workspace_from_state(request)
        return await workspace_manager.get_rag(workspace)

    return _rag_dep

