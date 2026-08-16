# dsh-skill-hub

Remote skill provider for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness):
install skills from a JSON catalog through the standard `ctx.skills` registry —
no manual folder copying.

- `list()` — fetch + validate a curated catalog, expose its skills to the registry
- `get()` — fetch the `SKILL.md` body on demand from the owning repo
- Fail-soft semantics: a catalog outage yields an *incomplete observation* (consumers
  keep their last-good catalog), never an authoritative empty list

## Install

```sh
npm install @wwumit/dsh-skill-hub
# peer deps: @deepseek-ai/cordis, @deepseek-ai/dsh-skill
```

## Usage (composition)

```ts
import { Context } from '@deepseek-ai/cordis'
import * as skillHub from '@wwumit/dsh-skill-hub'

export function apply(ctx: Context) {
  ctx.plugin(skillHub, {
    catalogUrl: 'https://wwumit.github.io/skills-catalog/catalog.json',
    // providerName: 'hub'     // unique name on ctx.skills
    // rank: 250               // duplicate-name resolution (lower wins)
    // requestTimeoutMs: 10000
    // baseUrl: 'https://raw.githubusercontent.com'
    // branch: 'main'
  })
}
```

Once loaded, DSH's model session catalog includes the provider's skills and the
model can invoke them via the built-in `skill` tool.

## Catalog format

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-08-16T00:00:00Z",
  "skills": [
    {
      "name": "ccpa-check",
      "description": "CCPA/CPRA compliance check … Use when …",
      "repo": "wwumit/skills-compliance-intl",
      "version": "2.2.4",
      "files": ["SKILL.md", "scripts/ccpa-check.py"]
    }
  ]
}
```

Generate a catalog from a skill workspace with the included
`catalog/build-catalog.mjs` script (curated via `catalog/curated.json`).

## Development

```sh
pnpm install
pnpm test       # vitest (mocked fetch)
pnpm build      # tsc → lib/
```

## Model Experience

### Request context and condition

#### What the model sees

No system-prompt prose is added by this package. Skills served by the provider
appear in the standard model session catalog (`<available_skills>`) exactly like
locally installed skills, with `name` and `description` from the catalog.

#### Token effect

Zero direct token contribution: the provider only feeds the shared skills catalog,
whose rendering cost is owned by the DSH skill consumer (`@deepseek-ai/dsh-tool-skill`).

#### KV Cache effect

Independent of model requests; no prompt-prefix contribution, so cache reuse is
unaffected by provider activity.

## Known Limitations and Deferred Work

- **Body-only fetch** — `get()` currently fetches `SKILL.md` only; script/resource
  files listed in the catalog manifest are not yet downloaded into a local cache
  (`resourceBase` resolution is future work).
- **Catalog caching** — `list()` refetches on every call; a TTL cache keyed by the
  resolved catalog URL is planned.
- **Auth** — no support yet for private catalogs or signed URLs.
