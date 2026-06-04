# 会话画板 × OpenCove 设计对照与讨论稿

**日期**: 2026-06-02  
**状态**: v0.2.50 已实现；**2026-06-04 后续问题未关闭** → 见 `../handoff/2026-06-04-session-canvas-known-issues.md`  
**参考项目**: 仓库内 `opencove/`（OpenCove 空间画布工作台）  
**关联**: `2026-06-01-session-canvas-design.md`、用户截图 `PixPin_2026-06-01_22-53-49.png`

---

## 1. 你的反馈（本轮）

| # | 问题 | 你的期望 |
|---|------|----------|
| A | **终端预览**：第一次打开有时正常，过一会儿又变成「暂无输出」或看不到内容 | 预览应稳定、可持续，关闭再打开也不丢 |
| B | **独立桌面应用** | 画板应是**独立 OS 窗口**，不要只嵌在 EnsoAIPlus 主窗口里 |
| C | **缩放** | **两层**都要能缩放：① 整个画板窗口 ② **里面每个会话卡片** 也要能随意放大缩小 |

截图现状：两个 Claude Code 卡片，预览区均显示「暂无输出 — 打开该会话后将在此显示预览」，说明 **store 里没有可用的 `previewText`**（或合并后为空）。

---

## 2. OpenCove 是什么（我们读到的）

OpenCove（`opencove/README_ZH.md`）是 **空间化 AI 工作台**：

- **无限 2D 画布**（基于 `@xyflow/react`），终端 / Agent / 任务 / 笔记都是 **画布上的 Node**
- **工作区持久化**：布局、视口、终端输出、Agent 状态可恢复
- **终端真相在 Worker**：`presentationSnapshot`（含 `serializedScreen`）由服务端维护，客户端 attach 回放，**不拿 renderer 缓存当真相**（见 `docs/terminal/MULTI_CLIENT_ARCHITECTURE.md`）

与当前 EnsoAI **会话画板** 的本质差异：

| 维度 | OpenCove | EnsoAI 当前（0.2.49） |
|------|----------|----------------------|
| 布局 | 无限画布，节点任意坐标 | 主窗口内 **网格卡片列表** |
| 终端展示 | 节点内 **live xterm**（多客户端 attach） | 卡片内 **纯文本预览**（不挂第二套 PTY） |
| 节点缩放 | `useNodeFrameResize` + 四边/四角手柄，尺寸写入 node frame，并 **commit PTY geometry** | 仅外层悬浮窗可缩放；卡片仅 `resize-y` 拉高预览区 |
| 输出持久化 | Worker snapshot + scrollback + alt-screen 专门恢复逻辑 | 内存 `previewText` + 打开时从 xterm 读 buffer |
| 独立窗口 | 桌面应用本身即独立；另有 Website 等节点类型 | 画板是主窗口 portal 悬浮层 |

OpenCove 关键实现路径（供对齐时参考）：

- 节点缩放：`nodeFrameResize.ts`、`NodeResizeHandles.tsx`、`useTerminalResize.ts`
- 终端持久化：`ANSI_SCREEN_PERSISTENCE.md`、`TerminalPresentationSession`
- 画布状态：`workspaceCanvas/*` hooks、`resolveWorkspaceLayoutAfterNodeResize`

---

## 3. 问题 A：预览「过一会儿又没了」— 原因推断

结合 0.2.49 实现与用户截图，可能原因 **不止一个**（需你下次复现时对照）：

### 3.1 打开画板时的「同步」可能盖掉好数据

`SessionCanvasPanel` 在 `open` 时会调用 `refreshAllCanvasPreviews()`，从 **已注册的 xterm** 读 buffer 并 **写回** `previewText`。

风险：

- Agent 使用 **备用屏幕**（`ESC[?1049h`）时，xterm 的 scrollback buffer 往往 **看不到 TUI 内容**，读出来是空的 → 若逻辑误把「空字符串」当成有效 snapshot，会 **覆盖** 之前流式累积的预览（0.2.49 已对空 snapshot `continue`，但仍需验证边界情况）。
- 会话在列表里，但 **对应 AgentTerminal 未挂在 globalSessionIds**（非当前 worktree）→ **没有 reader、也没有 onData** → 预览从未写入或已被清空。

### 3.2 流式预览与真实终端仍是两套数据

EnsoAI 为性能 **刻意不在画板里挂 live xterm**（避免重复 PTY）。预览来自 `appendSessionPreviewChunk(PTY onData)`。

因此：

- 只有 **终端组件仍挂载且正在收 onData** 的会话**才有持续更新；
- 用户若只开着画板、不打开 Agent Tab，过一段时间后 **不会丢 store**，但也不会更新；若中间发生过 **sync / 切换 worktree / 卸载终端组件**，预览可能已被清空或未初始化。

### 3.3 与 OpenCove 的差距（根因级）

OpenCove：**Worker 持有 presentationSnapshot**，与 UI 是否打开无关。  
EnsoAI：**预览在 renderer 内存**，生命周期绑在 xterm 组件与 runtimeState。

**讨论结论方向**：要稳定，需要至少一条：

1. **短期**：预览只增不减（snapshot 不得用更短/更空内容覆盖）；打开画板时 **合并** 而非盲覆盖；alt-screen 走专用读取或沿用 last good preview。  
2. **中期（对齐 OpenCove）**：主进程维护 per-session 文本 snapshot（或复用现有 PTY snapshot 管线），画板只读 snapshot API。

---

## 4. 问题 B：独立桌面窗口 — 方案草图

目标：像 **Agent 任务面板**（`AgentTaskPanelWindow.ts`）一样，画板是 **第二个 BrowserWindow**，可拖到另一块显示器，而不占用主窗口 client 区域。

| 方案 | 说明 | 工作量 | 建议 |
|------|------|--------|------|
| **B1 独立 Electron 窗口** | 新 preload + `session-canvas.html` 路由，IPC：列表会话、聚焦主窗口某 session、接收 preview 推送 | 中 | **推荐**，与现有任务面板一致 |
| **B2 仅放大 portal** | 当前悬浮层全屏 | 小 | 不满足「独立应用」 |
| **B3 系统级独立 EXE** | 再拆一个进程 | 大 | 非必须 |

**讨论点**：

- 独立窗口内是否仍用 **文本预览**，还是允许 **每卡 live xterm**（工作量大，且涉及多 PTY attach）？
- 与主窗口如何同步：主进程 push `sessions + preview` vs 子窗口自己读 store（需共享状态或 IPC 快照）。

---

## 5. 问题 C：两层缩放 — OpenCove 怎么做、我们可怎么做

### 5.1 OpenCove 做法（摘要）

- 每个节点有 `NodeFrame`：`position + size (width, height)`
- `useNodeFrameResize`：拖边/角 → 更新 frame → **持久化到画布拓扑** → 终端节点再 `syncTerminalNodeSize` 提交 PTY 行列
- 画布整体还可 **缩放视口**（zoom/pan），与节点尺寸是两层概念

### 5.2 EnsoAI 可选实现（讨论）

| 层级 | 选项 | 体验 | 复杂度 |
|------|------|------|--------|
| **外层画板** | 已有右下角 resize + 记住 bounds；可加大 min/max、支持四边缩放 | 中 | 低 |
| **内层卡片** | **C1** CSS 仅纵向拉高（现状） | 不满足「随意缩放」 | 低 |
| | **C2** 每卡 width+height 可拖角，网格自动换行/重叠（类似 masonry） | 接近你要的 | 中 |
| | **C3** 改为 OpenCove 式 XYFlow 画布，每 session 一节点 | 最像 OpenCove | **高** |

**讨论建议**：

- 若坚持 **网格总览** 而非无限画布：优先 **C2**（每卡持久化 `cardLayout: { w, h }`），不必一次上 XYFlow。
- 若你希望 **和 OpenCove 一样拖来拖去**：需要 **C3**，应单独立项，和「会话画板 MVP」分开。

---

## 6. 建议实施顺序（待你拍板）

```text
Phase 1 — 预览可靠性（修 A）
  ├─ 禁止空/更短 snapshot 覆盖
  ├─ alt-screen / 无 reader 时保留 last preview
  └─ （可选）主进程 debounced preview 持久化

Phase 2 — 缩放（修 C）
  ├─ 外层窗口：四边/角 resize（对齐 OpenCove node 手感）
  └─ 内层卡片：拖角改 w/h + localStorage 持久化

Phase 3 — 独立窗口（修 B）
  └─ SessionCanvasWindow + IPC，与主窗口并行

Phase 4 — 架构升级（可选，对齐 OpenCove）
  └─ presentationSnapshot / 画布节点化 / live attach
```

---

## 7. 用户确认（2026-06-02）

| 项 | 决定 |
|----|------|
| 子窗口 | **预览 + 点击聚焦**（不可输入） |
| 预览复现 | **Ctrl+5 关后再开** 时丢失 |
| 卡片缩放 | **网格内每卡任意拉大拉小** |
| 实施顺序 | **先预览 → 缩放 → 独立窗口** ✅ |

## 8. v0.2.50 实现摘要

- **Phase 1**：`sessionPreviewCache`（localStorage）+ `mergePreviewSnapshot` 禁止空/更短覆盖；打开时 `hydratePreviewsFromCache`
- **Phase 2**：`useSessionCanvasCardResize` + `sessionCanvasCardSizes` 持久化
- **Phase 3**：`SessionCanvasWindow` 独立 `BrowserWindow`，Ctrl+5 / 侧栏按钮 `toggle`；主窗口 IPC 推送 snapshot

---

## 9. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-02 | 初稿：对照 OpenCove 阅读结论 + 三项反馈的讨论与阶段建议 |
| 2026-06-02 | 用户拍板后实现 v0.2.50 |
