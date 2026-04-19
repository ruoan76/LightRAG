import { describe, expect, test } from 'vitest'
import {
  WORKSPACE_ACCESS_DENIED_CODE,
  responseDetailAsSearchText,
  responseDetailHasWorkspaceAclCode,
  responseDetailLooksLikeWorkspaceAcl
} from './workspaceAclError'

describe('workspaceAclError', () => {
  test('responseDetailHasWorkspaceAclCode matches structured FastAPI body', () => {
    expect(
      responseDetailHasWorkspaceAclCode({
        detail: { code: WORKSPACE_ACCESS_DENIED_CODE, message: 'No access' }
      })
    ).toBe(true)
    expect(responseDetailHasWorkspaceAclCode({ detail: { code: 'other' } })).toBe(false)
    expect(responseDetailHasWorkspaceAclCode({ detail: 'string only' })).toBe(false)
  })

  test('responseDetailLooksLikeWorkspaceAcl falls back to English string detail', () => {
    expect(
      responseDetailLooksLikeWorkspaceAcl({
        detail: 'No access to this knowledge base workspace'
      })
    ).toBe(true)
  })

  test('responseDetailAsSearchText flattens validation array detail', () => {
    const text = responseDetailAsSearchText({
      detail: [{ type: 'value_error', msg: 'field required', loc: ['body'] }]
    })
    expect(text).toContain('field required')

    const mixed = responseDetailAsSearchText({
      detail: ['plain string', { msg: 'from object' }]
    })
    expect(mixed).toContain('plain string')
    expect(mixed).toContain('from object')
  })

  test('responseDetailAsSearchText stringifies object detail and handles stringify failure', () => {
    expect(
      responseDetailAsSearchText({
        detail: { foo: 1, nested: { bar: 'baz' } }
      })
    ).toContain('"foo":1')

    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(responseDetailAsSearchText({ detail: circular })).toBe('[object Object]')
  })

  test('responseDetailAsSearchText handles non-object primitive detail', () => {
    expect(responseDetailAsSearchText({ detail: 403 })).toBe('403')
    expect(responseDetailAsSearchText({})).toBe('')
  })

  test('responseDetailLooksLikeWorkspaceAcl heuristic when detail is not the stable code', () => {
    expect(
      responseDetailLooksLikeWorkspaceAcl({
        detail: 'Custom error: knowledge base foo and workspace bar'
      })
    ).toBe(true)
    expect(
      responseDetailLooksLikeWorkspaceAcl({
        detail: 'No access — try another workspace'
      })
    ).toBe(true)
  })

  test('responseDetailLooksLikeWorkspaceAcl rejects unrelated errors', () => {
    expect(responseDetailLooksLikeWorkspaceAcl({ detail: 'Rate limit exceeded' })).toBe(false)
    expect(responseDetailLooksLikeWorkspaceAcl(null)).toBe(false)
  })
})
