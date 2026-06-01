# 会话画板 v0.2.50 开发交接文档

**日期**: 2026-06-02  
**版本**: `0.2.50`（`package.json`，**未 push**）  
**上一版基线**: `6952dce`（v0.2.49，已推 `origin/main`）  
**状态**: 实现基本完成，**未做用户验收、未触发 Build**

---

## 1. 背景与用户确认

用户在 v0.2.49 验收后反馈三点，并已与产品方向对齐：

| 问题 | 用户确认方案 |
|------|----------------|
| 终端预览 Ctrl+5 关后再开变「暂无输出」 | 预览需持久、不可被空 snapshot 覆盖 |
| 独立桌面窗口 | **仅预览 + 点击聚焦主窗口**（画板内不可输入） |
| 缩放 | **网格内每卡可任意拖角改宽高**（非 OpenCove 无限画布） |
| 实施顺序 | Phase 1 预览 → Phase 2 卡片缩放 → Phase 3 独立窗口 ✅ |

讨论稿（含 OpenCove 对照）：`docs/plans/2026-06-02-session-canvas-opencove-design-discussion.md`

---

## 2. 本轮实现摘要（v0.2.50）

### Phase 1 — 预览可靠性

| 文件 | 作用 |
|------|------|
| `src/renderer/lib/previewSnapshotMerge.ts` | `shouldApplyPreviewSnapshot` / `mergePreviewSnapshot`：禁止用更空/更短内容覆盖 |
| `src/renderer/stores/sessionPreviewCache.ts` | `localStorage` 键 `enso-session-canvas-preview-cache`，与 runtime 合并展示 |
| `src/renderer/lib/refreshCanvasPreviews.ts` | 打开画板前 `hydratePreviewsFromCache()` |
| `src/renderer/stores/agentSessions.ts` | `append` / `set` / `refresh` 走 merge + 写 cache |
| `src/renderer/stores/terminal.ts` | 同上 |
| `src/renderer/lib/xtermBufferSnapshot.ts` | 读 buffer 时保留非空行（利于 TUI） |

### Phase 2 — 每卡 2D 缩放

| 文件 | 作用 |
|------|------|
| `src/renderer/components/canvas/useSessionCanvasCardResize.ts` | 右下角拖角，默认 320×300，min/max 限制 |
| `src/renderer/stores/settings/types.ts` | `sessionCanvasCardSizes: Record<key, {w,h}>` |
| `SessionCanvasCard.tsx` | 固定外层尺寸 + resize 手柄 |
| `SessionCanvasPanel.tsx` | 布局改为 `flex flex-wrap` |

### Phase 3 — 独立 OS 窗口

| 文件 | 作用 |
|------|------|
| `src/main/windows/SessionCanvasWindow.ts` | 第二 `BrowserWindow`，bounds 存 `userData/session-canvas-window-bounds.json` |
| `src/main/ipc/sessionCanvasPanel.ts` | toggle / snapshot / sync / focus |
| `src/renderer/session-canvas.html` + `session-canvas.tsx` | 子窗口入口 |
| `src/renderer/components/canvas/SessionCanvasStandaloneApp.tsx` | 子窗口 UI |
| `src/renderer/lib/buildSessionCanvasSnapshot.ts` | 主窗口组装 IPC 快照 |
| `src/renderer/lib/sessionCanvasSync.ts` | 防抖 push 到子窗口 |
| `src/shared/types/sessionCanvas.ts` + `ipc.ts` | 类型与通道 |
| `electron.vite.config.ts` | 增加 `session-canvas` 构建入口 |
| `src/renderer/App.tsx` | **移除** `DraggableSessionCanvasWindow`；Ctrl+5 → `sessionCanvasPanel.toggle()` |

**行为变化（重要）**：

- 画板不再以主窗口内悬浮层展示，改为 **独立窗口**（与 Agent 任务面板同模式）。
- 侧栏网格按钮 / `Ctrl+5` 调用 `window.electronAPI.sessionCanvasPanel.toggle()`。
- 主窗口在画板可见时每 300ms 防抖 `SESSION_CANVAS_SYNC` 推送快照。
- 子窗口点击卡片 → `SESSION_CANVAS_FOCUS_SESSION` → 主窗口切 worktree + Agent/Terminal Tab。

**保留但未删除的文件**（可后续清理）：

- `DraggableSessionCanvasWindow.tsx` — 已不再被 `App.tsx` 引用。

---

## 3. 未做 / 已知缺口

1. **未 push、未 Build、未用户复测** Ctrl+5 关后再开预览是否仍稳定。
2. **未跑完整 `pnpm test`**，仅跑过：
   - `previewSnapshotMerge.test.ts`
   - `terminalPreview.test.ts`
   - `pnpm run typecheck` ✅
3. **TUI 备用屏**（OpenCode 全屏）仍可能 xterm buffer 读不到内容；cache 可缓解但非 Worker 级 snapshot。
4. **子窗口首次打开** 依赖 `getSnapshot`；若主窗口尚未 hydrate，可能短暂空预览（需实机验证）。
5. 仓库根目录 Enso 父仓 **尚无 git commit**（仅 EnsoAI 子仓有历史）。

---

## 4. 验收清单（下一会话建议）

- [ ] `pnpm dev` 启动，开 2 个 Agent 会话产生输出
- [ ] `Ctrl+5` 打开 **独立** 会话画板窗口（非主窗口内浮层）
- [ ] 确认预览有内容 → 关闭画板 → 再开，预览仍在
- [ ] 拖卡片右下角改变宽高，重启应用后尺寸是否保留（settings 持久化）
- [ ] 点击卡片是否聚焦主窗口并跳转正确 worktree + Tab
- [ ] 提交后 push + `workflow_dispatch` Build，安装 `0.2.50` 再测

---

## 5. Git 与发布

```text
EnsoAI 子仓库
  基线: 6952dce (v0.2.49)
  本轮: 本地 commit（见 git log -1）
  分支: main
  远程: https://github.com/ZeroPointSix/EnsoAI
```

**提交时请勿纳入**（临时文件）：

- `.gh-*`、`.git-push-*`、`.test-*`、`.build-watch-*`、`.jobs.json`、`*.ps1` 监视脚本

**建议下一会话命令**（用户明确要求 push 时再执行）：

```powershell
cd E:\hushaokang\Data-code\Enso\EnsoAI
git push origin main
gh workflow run build-windows.yml
```

---

## 6. 关键代码入口（速查）

```text
Ctrl+5 / 侧栏按钮
  → preload sessionCanvasPanel.toggle
  → main SessionCanvasWindow.show
  → 子窗口 SessionCanvasStandaloneApp
  → IPC getSnapshot / sync

主窗口数据
  → buildSessionCanvasSnapshot()
  → agentSessions + terminal + sessionPreviewCache

聚焦
  → SESSION_CANVAS_FOCUS_SESSION
  → App.handleSessionCanvasFocus
```

---

## 7. 相关文档索引

| 文档 | 路径 |
|------|------|
| OpenCove 讨论稿 | `docs/plans/2026-06-02-session-canvas-opencove-design-discussion.md` |
| 初版画板设计 | `docs/plans/2026-06-01-session-canvas-design.md` |
| 工作区记录 | 上级 `Enso/Workspace.md` |
| 会话交接（简） | 上级 `Enso/session-handoff.md` |

---

> 编写：2026-06-02，任务终止前交接。
