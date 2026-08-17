<!-- wwumit brand header: governance-driven AI skills ecosystem -->
<p align="center"><b>wwumit</b> · 治理驱动的 AI 技能生态 — 规则 → 检查 → 评分 → 报告</p>
<p align="center">产品线：合规（compliancehub）· 股票 · 工具 · 数据层 <a href="https://github.com/wwumit/skills-catalog">catalog</a></p>
<hr>

# dsh-compliancehub

**跨境合规技能专家组** —— 装这个插件，得到一套可核验的跨境合规技能。

Remote skill provider for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness):
install skills from a JSON catalog through the standard `ctx.skills` registry —
no manual folder copying.

本插件**只提供跨境合规线（9 个技能）**：CCPA/GDPR/HIPAA/COPPA 的 check/guard 与 ccpa-compliance。
股票、数据分析、插件工具等其他技能线**不属于本插件**（详见 [wwumit 技能生态](https://github.com/wwumit/skills-catalog)）。
默认目录为线级 `catalog-compliance.json`，主目录 `catalog.json` 仍为全量登记层（开放数据层），保持不变。

- `list()` — fetch + validate a curated catalog, expose its skills to the registry
- `get()` — fetch the `SKILL.md` body on demand from the owning repo
- Fail-soft semantics: a catalog outage yields an *incomplete observation* (consumers
  keep their last-good catalog), never an authoritative empty list

## Install

```sh
npm install @wwumit/dsh-compliancehub
# peer deps: @deepseek-ai/cordis, @deepseek-ai/dsh-skill
```

## Usage (composition)

```ts
import { Context } from '@deepseek-ai/cordis'
import * as skillHub from '@wwumit/dsh-compliancehub'

export function apply(ctx: Context) {
  ctx.plugin(skillHub, {
    catalogUrl: 'https://wwumit.github.io/skills-catalog/catalog-compliance.json', // 默认即此（跨境合规线）
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
  "disclosureSchemaVersion": "0.2",
  "updatedAt": "2026-08-16T00:00:00Z",
  "skills": [
    {
      "name": "ccpa-check",
      "fullName": "wwumit/skills-compliance-intl",
      "skillFullName": "wwumit/skills-compliance-intl/skills/ccpa-check",
      "description": "CCPA/CPRA compliance check …",
      "repo": "wwumit/skills-compliance-intl",
      "version": "2.2.4",
      "disclosure": { "cloud": true, "network": ["https://compliancehub.cn"], "offlineMode": true },
      "files": ["SKILL.md", "scripts/ccpa-check.py"]
    }
  ],
  "repos": [
    { "fullName": "wwumit/skills-compliance-intl", "skillCount": 9,
      "cloudSkills": ["ccpa-check", "coppa-check", "gdpr-check", "hipaa-check"] }
  ]
}
```

Generate a catalog from a skill workspace with the included
`catalog/build-catalog.mjs` script (curated via `catalog/curated.json`).


## Verified (DSH 实机验证)

`verify-dsh.ts` 在真实 DSH 运行时验证通过（SkillRegistry + provider 注册）：

```
✅ ctx.skills.list() → 9 个跨境合规技能（线级 catalog-compliance.json）
✅ ctx.skills.get('ccpa-check') → 正文 {n} 字节
```

- 验证方式：注册 `ctx.skills.registerProvider` → 真实 `list()`/`get()` 调用线上 catalog
- 结果随版本演进记录在 CHANGELOG.md；目录收录方可用此作为"含实测结果"证据

## Listed on dshbase

已收录于 [dshbase 插件目录](https://dshbase.com/plugins/dsh-compliancehub/)（分类：Developer）。
安装：`dsh plugin add @wwumit/dsh-compliancehub`（兼容 dsh 0.1.0-rc.6）。

## Disclosure (DISCLOSURE v0.2 开放数据层)

catalog 提供**双颗粒度披露**（市场/目录构建期单请求抓取消费）：

```json
{
  "disclosureSchemaVersion": "0.2",
  "skills": [
    { "name": "ccpa-check", "fullName": "wwumit/skills-compliance-intl",
      "skillFullName": "wwumit/skills-compliance-intl/skills/ccpa-check",
      "disclosure": { "cloud": true, "network": ["https://compliancehub.cn"],
        "offlineMode": true, "apiKeys": [{"env": "COMPLIANCEHUB_API_KEY", "storage": "file-0600"}],
        "jurisdiction": ["US-CA"], "retention": "session" } }
  ],
  "repos": [
    { "fullName": "wwumit/skills-compliance-intl", "skillCount": 9,
      "cloudSkills": ["ccpa-check", "coppa-check", "gdpr-check", "hipaa-check"] }
  ]
}
```

- 线级目录 9 个跨境合规技能全部披露：4 个云端评分（compliancehub.cn）+ 5 个纯本地（cloud:false）
- 声明源 = SKILL.md frontmatter（snake_case）；聚合源 = catalog.json（camelCase）；构建脚本 `build-catalog.mjs` 可复现
- 披露检查由 `skill-compliance` v1.4.0 自动执行（D1/D3/D4 完整性 + 声明-代码一致性 + 宿主依赖）

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
