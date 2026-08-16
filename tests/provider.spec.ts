import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { HubProvider } from '../src/provider.js'
import { parseCatalog, CatalogError } from '../src/catalog.js'
import type { SkillCandidate, SkillLookupOptions } from '@deepseek-ai/dsh-skill'

const CATALOG = {
  schemaVersion: 1,
  updatedAt: '2026-08-16T00:00:00Z',
  skills: [
    {
      name: 'ccpa-check',
      description: 'CCPA/CPRA compliance check. Use when …',
      repo: 'wwumit/skills-compliance-intl',
      version: '2.2.4',
      files: ['SKILL.md', 'scripts/ccpa-check.py'],
    },
    {
      name: 'excel2insights',
      description: 'Structured data analysis. Use when …',
      repo: 'wwumit/skills-tools',
      version: '2.0.0',
      files: ['SKILL.md'],
    },
  ],
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function textResponse(body: string): Response {
  return new Response(body, { status: 200 })
}

function opts(): SkillLookupOptions {
  return {}
}

describe('HubProvider.list', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps catalog entries to candidates', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(CATALOG))
    const p = new HubProvider({ catalogUrl: 'https://example.com/catalog.json' })
    const result = await p.list(opts())
    expect(Array.isArray(result)).toBe(true)
    const candidates = result as readonly SkillCandidate[]
    expect(candidates).toHaveLength(2)
    const first = candidates[0]!
    expect(first.name).toBe('ccpa-check')
    expect(first.description).toContain('Use when')
    expect(first.provider).toBe('hub')
    expect(first.rank).toBe(250)
    expect(first.source).toBe('runtime')
    expect(first.invocation).toEqual({ modelInvocable: true, userInvocable: true })
    expect((first.locator as { repo: string }).repo).toBe('wwumit/skills-compliance-intl')
  })

  it('returns an incomplete observation on fetch failure (not authoritative absence)', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network down'))
    const p = new HubProvider({ catalogUrl: 'https://example.com/catalog.json' })
    const result = await p.list(opts())
    expect(result).toEqual({ candidates: [], complete: false })
  })

  it('returns an incomplete observation on non-200', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not found', { status: 404 }))
    const p = new HubProvider({ catalogUrl: 'https://example.com/catalog.json' })
    const result = await p.list(opts())
    expect(result).toEqual({ candidates: [], complete: false })
  })

  it('returns an incomplete observation on invalid catalog JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ schemaVersion: 99, skills: [] }))
    const p = new HubProvider({ catalogUrl: 'https://example.com/catalog.json' })
    const result = await p.list(opts())
    expect(result).toEqual({ candidates: [], complete: false })
  })
})

describe('HubProvider.get', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function candidate(): SkillCandidate {
    return {
      name: 'ccpa-check',
      description: 'desc',
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'runtime',
      provider: 'hub',
      rank: 250,
      locator: { repo: 'wwumit/skills-compliance-intl', version: '2.2.4', files: [] },
    }
  }

  it('fetches the SKILL.md body and returns a definition', async () => {
    const body = '---\nname: ccpa-check\ndescription: d\n---\n\n# content'
    vi.mocked(fetch).mockResolvedValue(textResponse(body))
    const p = new HubProvider({ catalogUrl: 'https://example.com/catalog.json' })
    const def = await p.get(candidate(), opts())
    expect(def).toBeDefined()
    expect(def!.content).toContain('# content')
    expect(def!.name).toBe('ccpa-check')
    // URL 构造正确
    const url = vi.mocked(fetch).mock.calls[0]![0]
    expect(String(url)).toBe(
      'https://raw.githubusercontent.com/wwumit/skills-compliance-intl/main/skills/ccpa-check/SKILL.md',
    )
  })

  it('returns undefined when fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('down'))
    const p = new HubProvider({ catalogUrl: 'https://example.com/catalog.json' })
    const def = await p.get(candidate(), opts())
    expect(def).toBeUndefined()
  })

  it('returns undefined when locator is missing', async () => {
    const p = new HubProvider({ catalogUrl: 'https://example.com/catalog.json' })
    const bad = candidate()
    const def = await p.get({ ...bad, locator: undefined }, opts())
    expect(def).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('parseCatalog', () => {
  it('rejects non-object roots', () => {
    expect(() => parseCatalog(null)).toThrow(CatalogError)
    expect(() => parseCatalog([])).toThrow(CatalogError)
  })

  it('rejects unsupported schemaVersion', () => {
    expect(() => parseCatalog({ schemaVersion: 2, skills: [] })).toThrow(/schemaVersion/)
  })

  it('rejects invalid skill names', () => {
    expect(() =>
      parseCatalog({ schemaVersion: 1, skills: [{ name: 'Bad Name', description: 'd', repo: 'a/b' }] }),
    ).toThrow(/name/)
  })

  it('rejects skills without description or repo', () => {
    expect(() =>
      parseCatalog({ schemaVersion: 1, skills: [{ name: 'ok-skill', repo: 'a/b' }] }),
    ).toThrow(/description/)
    expect(() =>
      parseCatalog({ schemaVersion: 1, skills: [{ name: 'ok-skill', description: 'd' }] }),
    ).toThrow(/repo/)
  })
})
