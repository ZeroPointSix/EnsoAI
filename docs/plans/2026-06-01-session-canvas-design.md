# 会话画板（Session Canvas）设计文档

**日期**: 2026-06-01  
**状态**: 已实现（方案 A MVP，2026-06-01）  
**关联**: `RunningProjectsPopover`、`AgentPanel`、`TerminalPanel`

---

## 概述

在主界面新增 **「画板」Tab**，以网格卡片形式 **总览当前所有已打开的 Agent 会话与 Shell 终端**，减少在 chat / terminal / 各 worktree 之间的来回切换。

本功能采用 **方案 A（轻量会话画板）**：画板内展示元数据 + 输出状态 + 文本预览，**不在画板内挂载可交互的 xterm**；用户单击卡片后跳转到对应 worktree 与 Agent/Terminal 面板进行操作。

### 核心目标

- **一屏总览**：所有活跃 Agent + 终端会话可见
- **少切换 Tab**：多数「看谁在用、是否在跑」在画板完成；需要输入时再点卡片聚焦
- **实现可控**：不重构全局 PTY 宿主，不 duplicate 终端实例

### 明确不做（方案 A 边界）

| 不做 | 原因 |
|------|------|
| 画板内多路 live xterm 同屏输入 | 每个 `AgentTerminal`/`ShellTerminal` 会 `terminal.create` 新 PTY，不能对同一 session 重复挂载 |
| 拖拽自由布局 / 持久化坐标 | 留作方案 B+，首版用响应式 CSS Grid |
| 替代 `RunningProjectsPopover` | 弹窗保留快捷键场景；画板是常驻主 Tab |

---

## 背景与方案选型

### 用户诉求

- 像「块画板」一样展示当前所有 Agent 和终端
- 不想为了看状态频繁切换主 Tab 或 worktree

### 技术约束（现有架构）

1. **PTY 单例**：`useXterm` → `window.electronAPI.terminal.create`，重复挂载 = 重复进程  
2. **终端已绑定面板**：`AgentPanel` 通过 `globalSessionIds` 保持 Agent 终端挂载；`TerminalPanel` 通过 `globalTerminalIds` 保持 Shell 终端挂载，并按 worktree 布局显示/隐藏  
3. **全局列表已有**：`useAgentSessionsStore.sessions`、`useTerminalStore.sessions`（由 `TerminalPanel` 的 `syncSessions` 同步）

### 方案对比（决策记录）

| 方案 | 说明 | 结论 |
|------|------|------|
| **A 轻量画板** | 网格卡片 + 状态 + 文本预览 + 点击聚焦 | **已选** |
| B 画板 + 单卡放大 | A + 下半屏放大预览（仍文本） | 后续迭代 |
| C 真·多终端同屏 | 全局终端宿主 + 画板只负责布局 | 工作量大，仅当 A 不够用再评估 |

---

## 用户需求

### 功能需求

1. **主 Tab「画板」**
   - 与 Agent / File / Terminal 等并列，可参与 Tab 顺序配置（`DEFAULT_TAB_ORDER` / localStorage）
   - 建议默认顺序：`chat` → `canvas` → `file` → `terminal` → …

2. **卡片内容（每张对应一个 Agent 或 Shell 终端）**
   - 类型标识：Agent / Terminal 图标
   - 显示名：`session.terminalTitle \|\| session.name`（Agent）；`terminal.title`（Shell）
   - 上下文：仓库名、worktree 路径或分支名
   - **输出状态**：idle / outputting / unread（复用 `agentSessions.runtimeStates`，Agent 卡片支持 `GlowCard` 或等价指示）
   - **文本预览**：最近若干行终端输出（去 ANSI），无输出时显示占位文案

3. **交互**
   - **单击卡片**：切换 worktree → 设置 active session → 切到 `chat` 或 `terminal` Tab（逻辑对齐 `RunningProjectsPopover.handleSelectItem`）
   - **顶部筛选**（可选首版）：按仓库/worktree/关键词过滤
   - **空状态**：无任何会话时引导「去 Agent 或 Terminal 新建」

4. **数据范围**
   - Agent：来自 `useAgentSessionsStore.sessions`（全局，含未激活 worktree）
   - Shell 终端：来自 `useTerminalStore.sessions`（由 `TerminalPanel` 同步）
   - 活跃 worktree 列表可参考 `useWorktreeActivityStore.activities`（与 Running Projects 一致）

### 非功能需求

- 遵循 `docs/design-system.md`：CSS 变量、`h-7`/`h-9`、`min-w-0 truncate` 等
- 不增加自动化测试（与项目现状一致）；以 TypeScript + Biome 保证质量
- 实现后版本号按项目规范递增（`package.json`）

---

## 架构设计

### 组件结构

```
MainContent
├── … 现有 Tab 内容 …
└── SessionCanvasPanel          # activeTab === 'canvas'
    ├── SessionCanvasToolbar    # 统计、搜索（可选）
    └── SessionCanvasGrid
        └── SessionCanvasCard[] # Agent | Terminal
```

### 新增文件（计划）

| 文件 | 职责 |
|------|------|
| `src/renderer/components/canvas/SessionCanvasPanel.tsx` | 画板主面板 |
| `src/renderer/components/canvas/SessionCanvasCard.tsx` | 单张卡片 |
| `src/renderer/components/canvas/index.ts` | 导出 |
| `src/renderer/lib/terminalPreview.ts` | 追加/截断预览文本（去 ANSI，保留末 N 行） |

### 修改文件（计划）

| 文件 | 变更 |
|------|------|
| `src/renderer/App/constants.ts` | `TabId` 增加 `'canvas'`；`DEFAULT_TAB_ORDER` 插入画板 |
| `src/renderer/App/storage.ts` | `VALID_TAB_IDS` 含 `canvas` |
| `src/renderer/components/layout/MainContent.tsx` | Tab 配置 + 画板内容区（`absolute inset-0`，与其他 Tab 一样保持挂载策略可选） |
| `src/renderer/stores/agentSessions.ts` | `SessionRuntimeState.previewText` + `appendSessionPreview` |
| `src/renderer/components/chat/AgentTerminal.tsx` | `onData` 时调用 `appendSessionPreview` |
| `src/renderer/stores/terminal.ts` | 可选：`previewText` 字段 + `appendTerminalPreview` |
| `src/renderer/components/terminal/ShellTerminal.tsx` | 传入 `terminalId`，`onData` 更新 store |
| `src/renderer/components/terminal/TerminalPanel.tsx` | 向 `ShellTerminal` 传递 tab `id` |
| `src/shared/i18n.ts` | 文案：画板、聚焦、空状态等 |
| `src/renderer/stores/settings/defaults.ts` | 可选：`switchToCanvas` 快捷键（如 Ctrl+5） |

### 数据流

```mermaid
flowchart TB
  subgraph sources [数据源]
    AS[agentSessions.sessions]
    TS[terminal.sessions]
    RT[runtimeStates.previewText]
  end

  subgraph panel [SessionCanvasPanel]
    G[按 worktree 分组 / 网格]
    C[SessionCanvasCard]
  end

  subgraph action [用户点击]
    SW[onSelectWorktreeByPath]
    SA[setActiveId Agent / setActiveSession Terminal]
    TAB[onTabChange chat | terminal]
  end

  AS --> G
  TS --> G
  RT --> C
  C --> SW --> SA --> TAB
```

### 预览文本

- 工具函数：`appendTerminalPreview(current, chunk)`（`lib/terminalPreview.ts`）
- 限制：约 6000 字符 / 末 12 行，strip ANSI
- Agent：在 `AgentTerminal.handleData` 写入 `runtimeStates[sessionId].previewText`
- Shell：在 `ShellTerminal` 的 `onData` 写入 `terminal` store（需 tab id）
- **注意**：未打开过对应 Tab 的会话可能无预览，卡片显示「暂无输出」即可

### 与 RunningProjectsPopover 的关系

| 能力 | Running Projects 弹窗 | 会话画板 Tab |
|------|----------------------|--------------|
| 入口 | 快捷键 / 侧栏按钮 | 主 Tab 常驻 |
| 布局 | 列表 + 搜索 | 网格卡片 + 预览 |
| 聚焦逻辑 | `handleSelectItem` | **复用同一套** props 回调 |
| 关闭全部 Agent/Terminal | 支持 | 首版可不做了，或后续加工具栏按钮 |

---

## UI 规格（草案）

### 网格

- `grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 p-4`
- 卡片最小高度约 `200px`，预览区 `flex-1` + `font-mono text-xs` + `overflow-hidden`

### 卡片结构

```
┌─────────────────────────────────┐
│ [Agent图标] 名称        [状态点] │
│ repo / branch                   │
├─────────────────────────────────┤
│  preview text (muted, mono)     │
│  ...                            │
├─────────────────────────────────┤
│ worktree 路径 truncate          │
└─────────────────────────────────┘
```

### Tab 栏

- 图标建议：`LayoutGrid`（lucide-react）
- 文案：**Enso**（i18n，主 Tab 与面板标题）

---

## 实现阶段建议

### Phase 1（MVP — 方案 A）

- [x] Tab + `SessionCanvasPanel` + 卡片网格
- [x] Agent/Terminal 列表与点击聚焦
- [x] Agent + Shell 预览文本管线
- [x] 基础 i18n + Ctrl+5 快捷键

### Phase 2（体验增强，仍属方案 A 范围）

- [ ] Shell 终端预览文本
- [ ] 顶部搜索/筛选
- [ ] 按 worktree 分组标题
- [ ] `switchToCanvas` 快捷键与设置项

### Phase 3（方案 B，待产品确认）

- [ ] 画板内选中卡片放大预览
- [ ] 卡片拖拽排序（`@dnd-kit`，项目已有依赖）

### Phase 4（方案 C，仅必要时）

- [ ] 全局终端宿主重构，画板内 live 多终端

---

## 风险与注意事项

1. **预览 ≠ 实时终端**：用户若期望在画板里直接输入，需产品说明或 Phase 4。  
2. **终端未访问过**：仅 sync 到 store 的 shell tab 才有条目；从未打开 Terminal Tab 的 worktree 可能无 shell 卡片。  
3. **性能**：卡片数量很多时（>20）注意预览文本内存；已有截断策略。  
4. **草稿代码**：讨论阶段曾在 `agentSessions` / `terminalPreview.ts` 写入部分预览字段草稿，实现前应以本文档为准做一次对齐与清理。

---

## 参考代码位置

| 模块 | 路径 |
|------|------|
| 运行中项目弹窗（聚焦逻辑参考） | `src/renderer/components/layout/RunningProjectsPopover.tsx` |
| Agent 会话 store | `src/renderer/stores/agentSessions.ts` |
| 终端 store | `src/renderer/stores/terminal.ts` |
| 主 Tab 定义 | `src/renderer/App/constants.ts` |
| 主内容 Tab 切换 | `src/renderer/components/layout/MainContent.tsx` |
| 设计规范 | `docs/design-system.md` |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-01 | 初稿：确认采用方案 A，记录范围、架构与实现清单 |
