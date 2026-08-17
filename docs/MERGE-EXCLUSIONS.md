# 合併排除清單（Merge Exclusions）

本檔記錄本 fork **刻意移除**的功能。與上游（`affaan-m/ECC`）合併時，
凡是清單內的路徑或設定，**一律不併入**，直接捨棄。

> 上一次全面套用：2026-08-17（合併上游 52 個 commit，處理 40 個衝突檔）。

---

## 1. 移除紀錄（Removal Ledger）

本 fork 的移除分散在 6 個 commit。**合併衝突幾乎都源自這幾個 commit**，
因為上游仍在持續開發我們已經拿掉的東西。

| Commit | 移除內容 |
|--------|----------|
| `7dd7f92d` | npm registry 發佈（改為只發 GitHub Release 附件） |
| `0e972458` | 過時的 legacy rule 文件（`rules/common_old/`） |
| `8712fb0f` | CodeBuddy 安裝目標 |
| `3208b6f6` | Cursor、Gemini、Hermes、Kimi、Kiro、OpenClaw 目標與相關 scaffolding |
| `0b202b07` | OpenCode、Qwen、Trae、Zed 整合 |
| `465cd72f` | ecc2 實驗性 Rust runtime、control pane、agent proximity、observability readiness |

---

## 2. 已移除的 harness / 安裝目標

**保留的目標只有這 5 個**：`claude`、`claude-project`、`antigravity`、`codex`、`joycode`。

其他一律排除。上游若帶回下列任何目錄，整個丟掉：

```
.codebuddy/    .cursor/     .gemini/     .hermes/     .kimi/
.kiro/         .openclaw/   .opencode/   .qwen/       .trae/     .zed/
```

對應的程式與測試（上游若復原，一併排除）：

```
scaffolds/cursor/
scripts/build-opencode.js
scripts/gemini-adapt-agents.js
scripts/hooks/cursor-session-env.js
scripts/lib/cursor-agent-names.js
scripts/lib/install-targets/codebuddy-project.js
scripts/lib/install-targets/cursor-project.js
scripts/lib/install-targets/gemini-project.js
scripts/lib/install-targets/hermes-home.js
scripts/lib/install-targets/kimi-project.js
scripts/lib/install-targets/opencode-home.js
scripts/lib/install-targets/openclaw-home.js
scripts/lib/install-targets/qwen-home.js
scripts/lib/install-targets/zed-project.js
scripts/lib/mcp-inventory/readers/opencode.js
scripts/lib/session-adapters/opencode.js
skills/hermes-imports/
skills/openclaw-persona-forge/
docs/HERMES-OPENCLAW-MIGRATION.md
docs/HERMES-SETUP.md
docs/QWEN-GUIDE.md
tests/hooks/cursor-block-no-verify.test.js
tests/lib/session-adapters-opencode.test.js
tests/opencode-config.test.js
tests/opencode-plugin-hooks.test.js
tests/opencode-tools.test.js
tests/scripts/build-opencode.test.js
tests/scripts/gemini-adapt-agents.test.js
tests/scripts/openclaw-persona-forge-gacha.test.js
tests/scripts/trae-install.test.js
```

> **注意**：`.pi/`（Pi harness）**不在**排除清單內。它是上游新增、我們保留的目標。

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
tests/docs/ecc2-release-surface.test.js
tests/lib/agent-proximity.test.js
tests/lib/control-pane-*.test.js
tests/scripts/control-pane.test.js
tests/scripts/observability-readiness.test.js
```

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
| `files` | `.hermes/`、`.kimi/`、`.opencode/`、`.openclaw/`、`.qwen/`、`.zed/` |
| `files` | `scripts/control-pane.js`、`scripts/observability-readiness.js` |
| `bin` | `ecc-control-pane` |
| `scripts` | `control:pane`、`observability:ready` |
| `devDependencies` | `@opencode-ai/plugin` |

### `scripts/ecc.js`

排除 `control-pane` 指令定義、`PRIMARY_COMMANDS` 中的 `'control-pane'`、
以及說明文字裡的 `ecc control-pane --port 8765` 範例。

### `manifests/install-modules.json`

- `paths` 排除 `.cursor`、`.gemini`、`.opencode`、`.qwen`、`.zed`
- **每個 module 的 `targets` 陣列**只能包含保留的 5 個目標。
  上游新增模組（例如 `nasiko-control-plane`）常帶滿所有目標，必須過濾，
  否則 `tests/lib/install-manifests.test.js` 會整批失敗。

### `scripts/lib/install-manifests.js`

`LEGACY_COMPAT_BASE_MODULE_IDS_BY_TARGET` 只保留 `claude`、`claude-project`、`antigravity`。
排除 `TARGET_DEFAULT_PROFILE_IDS` 與 `TARGET_DEFAULT_EXCLUSIONS`（兩者只服務 opencode）。

### `scripts/lib/harness-adapter-compliance.js` 與 `docs/architecture/harness-adapter-compliance.md`

adapter 記錄只保留：`claude-code`、`codex`、`pi`、`dmux`、`orca`、`superset`、`ghast`、`terminal-only`。
`verification_commands` 不得出現 `npm run observability:ready`。

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
| Antigravity 專案根目錄 | `.agent/` | `.agents/` |
| Antigravity agents 對應 | `agents/` → `skills/` | `agents/` → `agents/` |
| Antigravity legacy 基礎模組 | 3 個 | 加上 `skill-unified-memory`、`workflow-quality` |
| Co-Authored-By | 「ECC 不提供覆寫」 | ECC 安裝預設寫入 `includeCoAuthoredBy: false` |
| 解除安裝行為 | 直接刪除 | 摘要無法驗證或為 symlink 者保留，狀態回報 `partial` |

---

## 8. 合併後檢查

```bash
# 1. 排除的檔案是否被帶回
git status --porcelain | grep -E 'ecc2/|control-pane|agent-proximity|proximity-tick|observability-readiness'

# 2. 排除的 harness 目錄是否重現
ls -d ecc2 .cursor .kiro .opencode .qwen .zed .gemini .hermes .kimi .openclaw .codebuddy .trae 2>/dev/null

# 3. 設定檔關鍵字
grep -rn -E 'control-pane|control:pane|ecc-control-pane|observability:ready|agent-proximity|ecc2/' \
  package.json scripts/ecc.js .gitignore .github/dependabot.yml

# 4. manifest 的 targets 是否混入已移除目標
node -e "const m=require('./manifests/install-modules.json');
const ok=['claude','claude-project','antigravity','codex','joycode'];
const bad=m.modules.filter(x=>(x.targets||[]).some(t=>!ok.includes(t)));
console.log(bad.length?bad.map(x=>x.id):'clean');"

# 5. 完整測試
node tests/run-all.js
```

前四項都**沒有輸出**（第 4 項印出 `clean`）才算乾淨。

若上游帶回整個目錄：

```bash
git rm -r --cached <dir> && rm -rf <dir>
```

---

## 9. 維護

- 再移除任何功能時，**同時**更新第 1 節的移除紀錄與對應章節。清單不完整＝下次合併加倍痛。
- 決定重新引入某功能時，把該章節整段刪除，不要留註解。
