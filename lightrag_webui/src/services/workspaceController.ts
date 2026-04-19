/**
 * Cancels in-flight HTTP requests when the user switches knowledge base (workspace).
 * Axios requests attach {@link getWorkspaceAbortSignal}; switching workspace replaces the controller.
 */
let abortController = new AbortController()

export function getWorkspaceAbortSignal(): AbortSignal {
  return abortController.signal
}

export function abortInFlightWorkspaceRequests(): void {
  abortController.abort()
  abortController = new AbortController()
}
