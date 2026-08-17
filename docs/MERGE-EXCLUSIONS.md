# 合併排除清單（Merge Exclusions）

本檔記錄本專案**刻意移除**的功能與檔案。日後與主版本（upstream）合併時，
若上游帶回下列任何路徑或設定，**一律不要併入**，直接捨棄。

- 來源 commit：`465cd72f` — `refactor(ecc2): remove experimental rust runtime, control pane, and proximity features`
- 移除日期：2026-08-10
- 影響：41 個檔案刪除，約 63,000 行

---

## 1. ecc2 實驗性 Rust runtime（整個目錄）

**排除整個 `ecc2/` 目錄**，包含但不限於：

```
ecc2/Cargo.lock
ecc2/Cargo.toml
ecc2/README.md
ecc2/rust-toolchain.toml
ecc2/src/comms/mod.rs
ecc2/src/config/mod.rs
ecc2/src/main.rs
ecc2/src/notifications.rs
ecc2/src/observability/mod.rs
ecc2/src/session/daemon.rs
ecc2/src/session/manager.rs
ecc2/src/session/mod.rs
ecc2/src/session/output.rs
ecc2/src/session/runtime.rs
ecc2/src/session/store.rs
ecc2/src/tui/app.rs
ecc2/src/tui/dashboard.rs
ecc2/src/tui/mod.rs
ecc2/src/tui/widgets.rs
ecc2/src/worktree/mod.rs
```

## 2. Control Pane（操作面板）

```
scripts/control-pane.js
scripts/lib/control-pane/actions.js
scripts/lib/control-pane/message-sink.js
scripts/lib/control-pane/proximity-viz.js
scripts/lib/control-pane/proximity.js
scripts/lib/control-pane/server.js
scripts/lib/control-pane/state.js
scripts/lib/control-pane/ui.js
```

## 3. Agent Proximity（代理鄰近度）

```
scripts/lib/agent-proximity/distance.js
scripts/lib/agent-proximity/graph.js
scripts/lib/agent-proximity/index.js
scripts/proximity-tick.js
```

## 4. Observability Readiness

```
scripts/observability-readiness.js
```

## 5. 對應測試

```
tests/docs/ecc2-release-surface.test.js
tests/lib/agent-proximity.test.js
tests/lib/control-pane-actions.test.js
tests/lib/control-pane-message-sink.test.js
tests/lib/control-pane-proximity.test.js
tests/lib/control-pane-state.test.js
tests/scripts/control-pane.test.js
tests/scripts/observability-readiness.test.js
```

---

## 6. 設定檔中已移除的條目（合併時要逐項檢查）

這些不是整檔刪除，而是檔案內被刪掉的行。上游合併時容易被悄悄帶回來。

### `package.json`

| 區塊 | 已移除的內容 |
|------|--------------|
| `files` | `scripts/control-pane.js` |
| `files` | `scripts/observability-readiness.js` |
| `bin` | `"ecc-control-pane": "scripts/control-pane.js"` |
| `scripts` | `"observability:ready": "node scripts/observability-readiness.js"` |
| `scripts` | `"control:pane": "node scripts/control-pane.js"` |

### `scripts/ecc.js`

| 區塊 | 已移除的內容 |
|------|--------------|
| `COMMANDS` | `control-pane` 指令定義 |
| `PRIMARY_COMMANDS` | `'control-pane'` |
| 說明文字 | `ecc control-pane --port 8765` 範例 |

### `.github/dependabot.yml`

- 移除 `package-ecosystem: "cargo"` / `directory: "/ecc2"` 整個區塊（含 `cargo-security`、`cargo-minor-and-patch` 群組）

### `.gitignore`

- 移除 `# Rust build artifacts` 與 `ecc2/target/`

### 其他有引用被清掉的檔案

這些檔案本身保留，但內部對上述功能的引用已移除。合併時注意不要復原：

```
docs/architecture/harness-adapter-compliance.md
scripts/lib/harness-adapter-compliance.js
scripts/operator-readiness-dashboard.js
scripts/preview-pack-smoke.js
tests/docs/harness-adapter-compliance.test.js
tests/scripts/ecc.test.js
tests/scripts/npm-publish-surface.test.js
tests/scripts/operator-readiness-dashboard.test.js
tests/scripts/platform-audit.test.js
```

---

## 7. 合併時的檢查步驟

合併上游後、commit 之前，跑這段確認排除項目沒有回來：

```bash
# 檢查是否有被排除的檔案被帶回
git status --porcelain | grep -E 'ecc2/|control-pane|agent-proximity|proximity-tick|observability-readiness'

# 檢查設定檔是否被帶回關鍵字
grep -rn -E 'control-pane|control:pane|ecc-control-pane|observability:ready|agent-proximity|ecc2/' \
  package.json scripts/ecc.js .gitignore .github/dependabot.yml
```

兩個指令都**沒有輸出**才算乾淨。

若上游用 `git merge` 帶回整個 `ecc2/` 目錄，直接：

```bash
git rm -r --cached ecc2 && rm -rf ecc2
```

---

## 8. 維護

- 之後若再移除其他功能，請把路徑補進本檔對應章節，並更新來源 commit。
- 若日後決定重新引入某項功能，把該章節整段刪除，不要留註解。
