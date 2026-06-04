# 会话看板（Session Canvas）— 问题陈述与修复记录

> 更新：2026-06-04  
> 分支：**dev** | 包版本：**0.2.85+**（提交 `97fd7d1` / `874ae78`）  
> 产物：**EnsoAIPlus Dev** → GitHub Actions `windows-installer-dev`  
> **讨论纪要**：[../../../docs/session-canvas/2026-06-04-discussion-record.md](../../../docs/session-canvas/2026-06-04-discussion-record.md)（Enso 根目录 `docs/`）

---

## 1. 用户侧问题定义（尚未完全验收关闭）

### 1.1 预览与滚动

| 现象 | 说明 |
|------|------|
| 预览与主窗不一致 | 主窗 Agent 终端有完整对话（如 `Thought for`、`Crunched`、中文回复），看板卡片仍显示 `? for shortcuts`、乱码或极短几行 |
| 无法可靠滚动 | 缩略卡与单击放大后的聚焦卡，预览区难以上下滚动；内容过短时表现为「滑不动」 |
| 独立看板 | Ctrl+5 独立窗口，数据来自主窗 IPC 快照，非本进程 live store |

### 1.2 四色状态灯

| 颜色 | 预期 | 实际问题（曾出现） |
|------|------|-------------------|
| 黄 `working` | Agent 执行中 | 任务结束后仍黄；或修后几乎不黄 |
| 绿 `completed` | Stop 后约 1 分钟 | 常被预览里的 `Cooked for` 误判挡住 |
| 灰 `idle` | 空闲 | — |
| 红 `blocked` | 需确认 | — |

### 1.3 交互（相对次要）

- **单击** → 浮层快捷输入；**Ctrl+单击** → 跳转主窗（0.2.78 已恢复，勿改回双击逻辑）
- 曾：浮层发灰、`pointer-events-none` 导致点不了（0.2.77–0.2.78 已修）

### 1.4 测试与 CI 缺口

- 本地 `pnpm test`：约 **86** 项（字符串合并、点击意图、状态 resolve 等），**无 UI/E2E**
- `.github/workflows/ci.yml`：**不跑** `pnpm test`，仅 `typecheck` + `build`
- **测试全绿 ≠ 看板真机可用**

---

## 2. 架构根因（与 OpenCove 差距）

参考：`EnsoAI/docs/plans/2026-06-02-session-canvas-opencove-design-discussion.md`、仓库内 `opencove/`

| 维度 | OpenCove | EnsoAI 当前 |
|------|----------|-------------|
| 预览 | Worker `presentationSnapshot` + `SerializeAddon` | renderer `previewText` + `readXtermBufferSnapshot` / 曾用 PTY 流 |
| 状态 | 主进程 `ptyState`：`working` \| `standby` 广播 | Hook + `outputState` + 曾用预览启发式 |
| 看板形态 | XYFlow 无限画布节点 | 绝对定位卡片列表 + 独立 BrowserWindow |

**核心矛盾**：Claude TUI 在**备用屏**画对话，PTY 字节流与 xterm 屏幕内容不一致；用预览文本猜 `working` 会被 scrollback 里的 `Cooked for` / `esc to interrupt` 误导。

---

## 3. 已尝试的修复（按版本，非「已解决」声明）

| 版本 | 提交主题 | 内容 | 用户反馈摘要 |
|------|----------|------|--------------|
| 0.2.77 | 点击/灰卡 | 去掉 `pointer-events-none`；光晕跟 `agentDisplayState` | 点击习惯被改坏 → 0.2.78 恢复 |
| 0.2.78 | 预览 merge | `mergeCanvasRefreshPreview`、低信号过滤 | 仍不同步 |
| 0.2.79 | 滚动布局 | 浮层 `overflow-y-auto`、`canvasMinHeight`、预览取长文本 | 仍不能滚/仍乱码 |
| 0.2.80 | 快照推送 | 禁止推送前 refresh；独立窗信 IPC | — |
| 0.2.81 | xterm 权威 | 已挂载 xterm 用屏幕快照；PTY 不 append | 用户称预览「算正常」 |
| 0.2.82 | bump | 触发 Build | — |
| 0.2.83 | 状态灯 | 不把历史 `Cooked`/`esc` 当 working | **一直黄** → **又不黄** |
| 0.2.84 | OpenCove 式状态 | `outputState===outputting`→黄；预览不猜 working；独立窗用快照 `agentDisplayState` | **仍未验收通过** |

### 3.1 关键文件（EnsoAI）

```
预览：AgentTerminal.tsx, agentSessions.ts, sessionPreviewCache.ts,
      previewSnapshotMerge.ts, canvasPreviewQuality.ts, xtermBufferSnapshot.ts
快照：buildSessionCanvasSnapshot.ts, sessionCanvasSync.ts, SessionCanvasStandaloneApp.tsx
展示：SessionCanvasCard.tsx, SessionCanvasPreview.tsx, SessionCanvasPanel.tsx
状态：canvasCardDisplayStore.ts, resolveCanvasAgentDisplayState.ts, inferDisplayFromPreview.ts
```

### 3.2 布局回归嫌疑（未改回）

- **`7f52071`**：聚焦态 `grid-rows-[minmax(4.5rem,38%)_minmax(11rem,1fr)]`，预览区最多约 **38%**，输入区占大头 → 不利于「看终端输出」与滚动
- **`4d1dd586`**：快捷输入合并、多层 `overflow-hidden` → 滚轮可能落在错误容器

---

## 4. 为什么仍未在用户环境认定「已解决」

1. 修复在 **PTY 流 / xterm 快照 / IPC / 启发式合并** 之间多次摇摆，缺少统一验收标准下的真机记录。
2. **状态灯**三条链路（Hook、`outputState`、预览推断、独立窗二次解析）曾互相覆盖。
3. **布局**与**数据**问题叠加，体感为「不能滚 + 看不到输出」。
4. **单测与 CI** 覆盖不到 DOM 滚动与真机灯色。
5. 用户反馈：**0.2.82 预览尚可；0.2.83/0.84 灯仍不对**（或未装对应 Build）— 文档记录时以用户口述为准，**不代验收**。

---

## 5. 建议验收标准（待用户确认后执行）

1. 主窗 Agent 会话可见，发送一条消息并等待长回复。
2. 打开会话看板（独立窗或主窗触发），等待 **2–3 秒** 快照同步。
3. **预览**：卡片黑色区域应出现与主窗尾部一致的中文/英文内容（非仅 shortcuts）。
4. **滚动**：预览内容超过一屏时，在预览区内滚轮可上下移动。
5. **黄灯**：输出过程中为黄；结束后绿灯约 60s 再灰（或至少不长期黄）。

---

## 6. 若继续开发（不在本轮范围）

| 优先级 | 方向 |
|--------|------|
| P0 | 对齐 OpenCove：`@xterm/addon-serialize` 或主进程 per-session snapshot API |
| P1 | 聚焦布局回退 `5de7f39` 式：预览 `flex-1`，输入 `shrink-0` |
| P2 | CI 增加 `pnpm test`；补 Playwright 看板 smoke |
| P3 | 独立看板 `outputState` 与主窗强制同步频率/事件 |

---

## 7. 相关文档

- `EnsoAI/docs/plans/2026-06-02-session-canvas-opencove-design-discussion.md`
- `EnsoAI/docs/plans/2026-06-02-session-canvas-ux-v2-discussion.md`
- `EnsoAI/docs/handoff/2026-06-02-session-canvas-v0.2.50-handoff.md`
- 父仓 `session-handoff.md`、`Workspace.md`
