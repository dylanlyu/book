# 合併排除清單（Merge Exclusions）

本檔記錄本 fork **刻意移除**的功能。與上游（`affaan-m/ECC`）合併時，
凡是清單內的路徑或設定，**一律不併入**，直接捨棄。

> 上一次全面套用：2026-08-17（合併上游 52 個 commit，處理 40 個衝突檔）。
> 同日移除 Pi harness、Antigravity 目標與 JoyCode 目標（見第 1、2 節）。
> 2026-08-18 移除全部翻譯文件、release 文件與 locale 安裝功能（見第 8 節）。

---

## 1. 移除紀錄（Removal Ledger）

本 fork 的移除分散在 7 個 commit。**合併衝突幾乎都源自這幾個 commit**，
因為上游仍在持續開發我們已經拿掉的東西。

| Commit | 移除內容 |
|--------|----------|
| `7dd7f92d` | npm registry 發佈（改為只發 GitHub Release 附件） |
| `0e972458` | 過時的 legacy rule 文件（`rules/common_old/`） |
| `8712fb0f` | CodeBuddy 安裝目標 |
| `3208b6f6` | Cursor、Gemini、Hermes、Kimi、Kiro、OpenClaw 目標與相關 scaffolding |
| `0b202b07` | OpenCode、Qwen、Trae、Zed 整合 |
| `465cd72f` | ecc2 實驗性 Rust runtime、control pane、agent proximity、observability readiness |
| `01f5ba4b` | Pi harness 與 Antigravity 安裝目標（含 legacy `.agent` 遷移路徑） |
| `6bb0edaa` | JoyCode 安裝目標（`.joycode/` adapter、扁平化 rules 佈局、guided wizard 的 advanced 提示） |
| _本次_ | 全部翻譯文件（12 個語言目錄）、release 文件（`docs/releases/`、`docs/drafts/`）、`docs/stale-pr-salvage-ledger.md`、`locale:*` 安裝元件家族，以及 8 份一次性工作日誌與 2 份孤兒設計文件 |

---

## 2. 已移除的 harness / 安裝目標

**保留的目標只有這 3 個**：`claude`、`claude-project`、`codex`。

其他一律排除。上游若帶回下列任何目錄，整個丟掉：

```
.agent/        .agents/*    .codebuddy/  .cursor/     .gemini/
.hermes/       .joycode/    .kimi/       .kiro/       .openclaw/
.opencode/     .pi/         .qwen/       .trae/       .zed/
```

> `.agents/` 有兩種用途，別搞混：**倉庫根目錄的 `.agents/`（Codex 的 skill metadata）要保留**；
> Antigravity 安裝到「使用者專案」的 `.agents/` 已隨目標移除。`.agent/` 是 Antigravity 的舊路徑，一律排除。

對應的程式與測試（上游若復原，一併排除）：

```
scaffolds/cursor/
scripts/build-opencode.js
scripts/gemini-adapt-agents.js
scripts/hooks/cursor-session-env.js
scripts/lib/cursor-agent-names.js
scripts/lib/install-targets/antigravity-project.js
scripts/lib/install-targets/codebuddy-project.js
scripts/lib/install-targets/cursor-project.js
scripts/lib/install-targets/gemini-project.js
scripts/lib/install-targets/hermes-home.js
scripts/lib/install-targets/joycode-project.js
scripts/lib/install-targets/kimi-project.js
scripts/lib/install-targets/opencode-home.js
scripts/lib/install-targets/openclaw-home.js
scripts/lib/install-targets/qwen-home.js
scripts/lib/install-targets/zed-project.js
scripts/lib/install/antigravity-agent.js
scripts/lib/install/antigravity-legacy-migration.js
scripts/lib/mcp-inventory/readers/opencode.js
scripts/lib/session-adapters/opencode.js
skills/hermes-imports/
skills/openclaw-persona-forge/
docs/ANTIGRAVITY-GUIDE.md
docs/HERMES-OPENCLAW-MIGRATION.md
docs/HERMES-SETUP.md
docs/JOYCODE-GUIDE.md
docs/QWEN-GUIDE.md
tests/docs/antigravity-guide.test.js
tests/hooks/cursor-block-no-verify.test.js
tests/lib/antigravity-legacy-migration.test.js
tests/lib/session-adapters-opencode.test.js
tests/opencode-config.test.js
tests/opencode-plugin-hooks.test.js
tests/opencode-tools.test.js
tests/pi/pi-extension-adapter.test.js
tests/pi/pi-package-manifest.test.js
tests/scripts/build-opencode.test.js
tests/scripts/gemini-adapt-agents.test.js
tests/scripts/openclaw-persona-forge-gacha.test.js
tests/scripts/trae-install.test.js
```

### 保留的同名項目（別誤刪）

| 保留 | 原因 |
|------|------|
| `commands/multi-*.md` 裡的 `--backend antigravity` | 那是**多模型後端**（`codeagent-wrapper`），與安裝目標無關 |
| `skills/angular-developer/references/mcp.md` 的 `.antigravity/mcp.json` | 那是 Antigravity IDE 自己的 MCP 設定教學，不是 ECC adapter |
| 倉庫根目錄 `.agents/` | Codex 的 skill metadata 佈局 |
| `scripts/lib/install/link-rewrite.js` | 與 antigravity 同批引入但為共用模組，`install-lifecycle` 仍在用 |
| `CHANGELOG.md`、`docs/SELECTIVE-INSTALL-DESIGN.md`、`docs/stale-pr-salvage-ledger.md` 裡的 JoyCode/Antigravity | 歷史發布紀錄、設計文件敘事與 PR 打撈帳本，照既有慣例保留原文 |
| `tests/lib/harness-capabilities.test.js` 的 `joycode` | 「不得再宣傳已移除 harness」的迴歸守門斷言，必須保留 |
| `applyMultiHarnessPlan` 的 managed 分派分支與 `guidedReady` / `availability` 欄位 | JoyCode 是最後一個 managed/advanced harness，目前無實例但保留擴充點以降低上游合併衝突 |

---

## 3. ecc2 實驗性 Rust runtime

**排除整個 `ecc2/` 目錄**，無例外。包含 `Cargo.toml`、`Cargo.lock`、
`rust-toolchain.toml`、`src/**`（main、config、comms、notifications、
observability、session、tui、worktree）。

---

## 4. Control Pane / Agent Proximity / Observability Readiness

```
scripts/control-pane.js
scripts/lib/control-pane/          （actions, message-sink, proximity, proximity-viz, server, state, ui）
scripts/lib/agent-proximity/       （distance, graph, index）
scripts/proximity-tick.js
scripts/observability-readiness.js
docs/architecture/observability-readiness.md
docs/design/agent-proximity.md
tests/docs/ecc2-release-surface.test.js
tests/lib/agent-proximity.test.js
tests/lib/control-pane-*.test.js
tests/scripts/control-pane.test.js
tests/scripts/observability-readiness.test.js
```

> 2026-08-18 補記：`docs/architecture/observability-readiness.md` 當初列在本節卻沒真的刪掉，
> 已於本次補刪；`docs/design/agent-proximity.md` 是同批的孤兒文件，一併加入清單。
> **尚未清乾淨**：`scripts/lib/control-pane/work-item-mutations.js` 仍在倉庫中，
> 是本節唯一的殘留項，處理前請先確認沒有現存消費者。

---

## 5. npm registry 發佈

本 fork **不發佈到 npm**，只產出 GitHub Release 附件。合併時排除：

- `.github/workflows/release.yml` 與 `reusable-release.yml` 中的
  `Setup Node.js`（帶 `registry-url`）與 `Publish npm package` 步驟
- `NODE_AUTH_TOKEN` / `secrets.NPM_TOKEN` / `--provenance` 相關設定
- `package.json` 的 `ecc-control-pane` bin、`control:pane`、`observability:ready` script

---

## 6. 設定檔中的逐行排除項

不是整檔刪除，而是檔案內被刪掉的行。**上游合併時最容易被悄悄帶回來**。

### `package.json`

| 區塊 | 排除項 |
|------|--------|
| `files` | `.hermes/`、`.kimi/`、`.opencode/`、`.openclaw/`、`.pi/`、`.qwen/`、`.zed/` |
| `files` | `scripts/control-pane.js`、`scripts/observability-readiness.js` |
| `bin` | `ecc-control-pane` |
| `scripts` | `control:pane`、`observability:ready` |
| `devDependencies` | `@opencode-ai/plugin` |
| 頂層 | `"pi": { extensions / skills / prompts }` 區塊（Pi 套件宣告） |

### `scripts/ecc.js`

排除 `control-pane` 指令定義、`PRIMARY_COMMANDS` 中的 `'control-pane'`、
以及說明文字裡的 `ecc control-pane --port 8765` 範例。

### `manifests/install-modules.json`

- `paths` 排除 `.cursor`、`.gemini`、`.opencode`、`.pi`、`.qwen`、`.zed`
- **每個 module 的 `targets` 陣列**只能包含保留的 4 個目標。
  上游新增模組（例如 `nasiko-control-plane`）常帶滿所有目標，必須過濾，
  否則 `tests/lib/install-manifests.test.js` 會整批失敗。

### `scripts/lib/install-manifests.js`

`SUPPORTED_INSTALL_TARGETS` 與 `LEGACY_COMPAT_BASE_MODULE_IDS_BY_TARGET` 只保留 `claude`、`claude-project`。
排除 `TARGET_DEFAULT_PROFILE_IDS` 與 `TARGET_DEFAULT_EXCLUSIONS`（兩者只服務 opencode）。
排除 `LEGACY_LANGUAGE_RULE_NAMESPACES` 與 `ruleLanguages`（只服務 Antigravity 的規則篩選，已無消費者）。

### `scripts/lib/harness-adapter-compliance.js` 與 `docs/architecture/harness-adapter-compliance.md`

adapter 記錄只保留：`claude-code`、`codex`、`dmux`、`orca`、`superset`、`ghast`、`terminal-only`。
排除 `pi` 記錄與文件表格中的 `| Pi |` 列。
`verification_commands` 不得出現 `npm run observability:ready`。

### `schemas/*.json` 與 `scripts/lib/install-targets/registry.js`

target 列舉與 `ADAPTERS` 陣列只能包含 `claude`、`claude-project`、`codex`。
上游帶回 `antigravity`、`pi` 或 `joycode` 時一併刪除，並確認 `scripts/lib/harness-capabilities.js`
的 harness 數量（2 個 harness / 3 個 target）與 `tests/lib/harness-capabilities.test.js` 一致。

### `scripts/lib/install-targets/helpers.js`

排除 `createFlatFileOperations`、`createFlatRuleOperations`、`createNamespacedFlatRuleOperations`
與 `listRelativeFiles`。這組扁平化 rules 的 helper 只服務 JoyCode adapter，目標移除後已無消費者。

### `scripts/install-guided.js`

排除 `ADVANCED_HARNESSES` 常數與 help／wizard 裡的「Advanced adapters」提示段落。
JoyCode 是最後一個 advanced harness，移除後該段輸出必然是空的。

### `scripts/lib/install-lifecycle.js` 與 `scripts/lib/install/apply.js`

排除 Antigravity legacy 遷移路徑：`getLegacyAntigravityLocation`、`inspectLegacyAntigravityState`、
`cleanupLegacyAntigravityInstall`、`adaptAntigravityAgent`、`antigravity-agent-frontmatter` transform，
以及 discovery/uninstall 的 `legacy` 記錄分支。

### `scripts/sync-ecc-to-codex.sh`

排除 `CURSOR_RULES_DIR`。保留 `ECC_RULES_DIR`（指向正規 `rules/`）與 `LEGACY_STATE_HELPER`。

### `.github/dependabot.yml`

排除 `package-ecosystem: "cargo"` / `directory: "/ecc2"` 整個區塊。

### `.gitignore`

排除 `# Rust build artifacts` 與 `ecc2/target/`。

---

## 7. 合併判斷原則

遇到衝突時依序判斷：

1. **屬於本清單的移除功能** → 保留我們的移除，丟掉上游那側。
2. **上游對我們保留功能的修正或強化** → **併進來**。不要因為衝突就整段取我們的。
3. **上游的錯誤修正（含事實性修正）** → 併進來，即使與我們現有文字矛盾。
   驗證方式：找對應測試，讓測試決定誰對。
4. **文件數字（agents / skills 數量）** → 不要照抄任一側，實際數。

```bash
echo "agents: $(ls agents/*.md | wc -l)   skills: $(ls -d skills/*/ | wc -l)"
```

### 已知的上游正確修正（不要退回舊值）

| 項目 | 舊（錯） | 新（對） |
|------|----------|----------|
| Co-Authored-By | 「ECC 不提供覆寫」 | ECC 安裝預設寫入 `includeCoAuthoredBy: false` |
| 解除安裝行為 | 直接刪除 | 摘要無法驗證或為 symlink 者保留，狀態回報 `partial` |

---

## 8. 翻譯文件與 release 文件

本 fork **只維護英文文件**。上游的翻譯目錄與 release 存檔一律不併入。

### 8.1 排除的目錄與檔案

```
docs/de-DE/    docs/es/       docs/ja-JP/    docs/ko-KR/
docs/pt-BR/    docs/ru/       docs/th/       docs/tr/
docs/ur/       docs/vi-VN/    docs/zh-CN/    docs/zh-TW/
docs/releases/                （1.8.0、1.10.0、2.0.0、2.0.0-rc.1、2.1.0 全部版本）
docs/drafts/                  （release 公告草稿）
docs/stale-pr-salvage-ledger.md
```

上游若帶回任一目錄，整個丟掉，不做選擇性保留。

### 8.2 保留的同名項目（別誤刪）

| 保留 | 原因 |
|------|------|
| `CHANGELOG.md`、`WORKING-CONTEXT.md` 裡提到 `docs/releases/` 的行 | 歷史紀錄，照既有慣例保留原文 |
| `skills/eval-harness/SKILL.md` 的 `docs/releases/<version>/eval-summary.md` | 那是**輸出路徑模板**，不是既有檔案 |
| README 中指向 `github.com/affaan-m/ECC/.../docs/releases/...` 的絕對 URL | 指向上游倉庫，仍可連通 |

### 8.3 連帶移除的 locale 安裝功能

翻譯目錄是 `locale:*` 安裝元件的內容來源，目錄移除後整個家族失去意義：

```
manifests/install-components.json   9 個 locale:* 元件（82 → 73）
manifests/install-modules.json      9 個 docs-* 模組（35 → 26）
package.json                        files 陣列中 9 個 docs/<lang>/ 路徑
tests/lib/locale-install.test.js    整檔（--locale 安裝測試）
```

上游若帶回 `locale:` 開頭的元件或 `docs-` 開頭的模組，一律刪除。

2026-09-04 補完當時遺留的殘骸（元件刪了、旗標沒刪，`--locale` 任何值都會在
`resolveInstallPlan` 拋 `Unknown install component`）：

```
scripts/lib/install-manifests.js       SUPPORTED_LOCALES、LOCALE_ALIAS_TO_COMPONENT_ID、
                                       listSupportedLocales、COMPONENT_FAMILY_PREFIXES.locale
scripts/lib/install/request.js         --locale 解析與正規化（含 hasNonLocaleManifestSelection，
                                       移除 locale 後與 usingManifestMode 等價，已併回一個變數）
scripts/install-apply.js               --locale 說明與 "Available locales" 區塊
scripts/ci/validate-install-manifests.js  locale family prefix
schemas/install-components.schema.json    id pattern 與 family enum 的 locale
tests/lib/install-request.test.js      5 個 locale 測試
```

`--locale` 現在會以 `Unknown argument: --locale` 被拒絕，並有兩道回歸測試守著
（`tests/lib/install-request.test.js` 的旗標守衛、`tests/lib/install-manifests.test.js`
的 `locale:*` 元件家族守衛），等同把第 7 項檢查搬進測試套件。

繁體中文輸出規則本身保留在 `rules/language/zh-tw.md`，隨 `rules-core` 預設安裝——
本 fork 只支援 zh-TW，沒有語系可選，所以不需要旗標。

### 8.4 連帶移除的 release 驗證面

`docs/releases/` 不只是存檔，它是下列腳本的**輸入資料**。這些腳本在本 fork 已無資料可讀：

```
scripts/platform-audit.js              讀 publication-evidence / operator-readiness-dashboard
scripts/preview-pack-smoke.js          讀 docs/releases/<version>
scripts/release-approval-gate.js       讀 docs/releases/<version>
scripts/release-video-suite.js         讀 ecc-2-hypergrowth-release-command-center.md
tests/docs/stale-pr-salvage-ledger.test.js   整檔
```

> 這些 release 腳本本身尚未移除，僅其文件輸入已不存在。
> 若要恢復 release 流程，需一併恢復 `docs/releases/`，或改寫腳本改用其他證據來源。

### 8.5 連帶修改的驗證程式與測試

上游合併時這些檔案最容易把翻譯路徑帶回來：

| 檔案 | 排除項 |
|------|--------|
| `scripts/ci/catalog.js` | 所有 `Zh*` 常數、parse/sync 函式與 `createDocumentSpecs` 的對應 spec，包含 `README_ZH_CN_PATH`、`parseZhRootReadmeExpectations`、`syncZhRootReadme` |
| `tests/ci/validators.test.js` | 所有 `zhDocs*` / `zhAgents*` / `zhRoot*` fixture 與斷言 |
| `tests/ci/catalog.test.js` | `writeZhDocsReadme` / `writeZhAgents` / `writeZhRootReadme` fixture 產生器與對應斷言 |
| `tests/plugin-manifest.test.js` | 針對 `docs/tr`、`docs/zh-CN`、`docs/pt-BR` 與根目錄 `README.zh-CN.md` 的 test 區塊與路徑變數 |
| `scripts/release.sh` | `ROOT_ZH_CN_README_FILE`、`TR_*`、`PT_BR_*`、`ZH_CN_*` 變數與其存在檢查、版號／heading 更新呼叫、`git add` 項目 |
| `README.md` | 頁首語言選擇器區塊（現在只剩英文，整塊移除） |
| `tests/docs/install-identifiers.test.js`、`tests/docs/configure-ecc-install-paths.test.js`、`tests/docs/continuous-learning-v2-docs.test.js`、`tests/skills/repo-scan-install.test.js`、`tests/lib/command-plugin-root.test.js`、`tests/ci/secret-curl-flags.test.js`、`tests/ci/unified-memory-surface.test.js` | 陣列中指向翻譯文件的路徑項 |
| `tests/docs/platform-value-loop.test.js` | `release docs link the platform value loop into the rc surface` 整個 test |

**注意**：`tests/ci/catalog.test.js` 與 `tests/ci/validators.test.js` 的「缺少文件時要報錯」測試，
刪除目標已從 `docs/zh-CN/AGENTS.md` 改為英文 `AGENTS.md`。測試意圖不變，別在合併時改回去。

### 8.6 一次性工作日誌

帶日期戳記的單次產物，任務結束後就是死文件。上游若補回，一律不併入：

```
docs/MEGA-PLAN-REPO-PROMPTS-2026-03-12.md
docs/PHASE1-ISSUE-BUNDLE-2026-03-12.md
docs/PR-399-REVIEW-2026-03-12.md
docs/PR-QUEUE-TRIAGE-2026-03-13.md
docs/fixes/HOOK-FIX-20260421.md
docs/fixes/HOOK-FIX-20260421-ADDENDUM.md
docs/fixes/INSTALL-HOOK-WRAPPER-FIX-20260422.md
docs/fixes/PATCH-SETTINGS-SIMPLE-FIX-20260422.md
```

`scripts/preview-pack-smoke.js` 的 `REQUIRED_ARTIFACTS` 已同步移除
`docs/architecture/observability-readiness.md`。

> **未處理**：`docs/fixes/` 仍留有 3 個配套腳本（`apply-hook-fix.sh`、
> `install_hook_wrapper.ps1`、`patch_settings_cl_v2_simple.ps1`）。
> 它們的說明文件已刪，形同孤兒，但屬本次授權範圍之外，保留待決。

---

## 9. 合併後檢查

```bash
# 1. 排除的檔案是否被帶回
git status --porcelain | grep -E 'ecc2/|control-pane|agent-proximity|proximity-tick|observability-readiness|antigravity|joycode|/\.pi/'

# 2. 排除的 harness 目錄是否重現
ls -d ecc2 .agent .pi .cursor .kiro .opencode .qwen .zed .gemini .hermes .joycode .kimi .openclaw .codebuddy .trae 2>/dev/null

# 3. 設定檔關鍵字
grep -rn -E 'control-pane|control:pane|ecc-control-pane|observability:ready|agent-proximity|ecc2/|antigravity|"pi"' \
  package.json scripts/ecc.js .gitignore .github/dependabot.yml schemas/*.json

# 4. manifest 的 targets 是否混入已移除目標
node -e "const m=require('./manifests/install-modules.json');
const ok=['claude','claude-project','codex'];
const bad=m.modules.filter(x=>(x.targets||[]).some(t=>!ok.includes(t)));
console.log(bad.length?bad.map(x=>x.id):'clean');"

# 5. 安裝目標註冊表與 schema 一致
node -e "const {listInstallTargetAdapters}=require('./scripts/lib/install-targets/registry');
console.log(listInstallTargetAdapters().map(a=>a.target).sort().join(','));"
# 應輸出：claude,claude-project,codex

# 6. 翻譯目錄與 release 文件是否被帶回
ls -d docs/de-DE docs/es docs/ja-JP docs/ko-KR docs/pt-BR docs/ru docs/th \
      docs/tr docs/ur docs/vi-VN docs/zh-CN docs/zh-TW docs/releases docs/drafts 2>/dev/null

# 7. locale 安裝元件與 docs-* 模組是否被帶回
node -e "const c=require('./manifests/install-components.json').components.filter(x=>x.family==='locale');
const m=require('./manifests/install-modules.json').modules.filter(x=>/^docs-/.test(x.id));
console.log(c.length||m.length?'DIRTY '+[...c.map(x=>x.id),...m.map(x=>x.id)]:'clean');"

# 8. 完整測試
node tests/run-all.js
```

第 1～3、6 項**沒有輸出**、第 4、7 項印出 `clean`、第 5 項輸出上面那一行，才算乾淨。

若上游帶回整個目錄：

```bash
git rm -r --cached <dir> && rm -rf <dir>
```

---

## 10. 維護

- 再移除任何功能時，**同時**更新第 1 節的移除紀錄與對應章節。清單不完整＝下次合併加倍痛。
- 決定重新引入某功能時，把該章節整段刪除，不要留註解。
