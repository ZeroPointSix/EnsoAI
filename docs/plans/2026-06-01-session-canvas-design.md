# 会话画板（Session Canvas）设计文档

**日期**: 2026-06-01  
**状态**: 已实现（方案 A MVP）；2026-06-01 晚改为**全局覆盖层**入口（非主 Tab）  
**关联**: `RunningProjectsPopover`、`AgentPanel`、`TerminalPanel`

---

## 概述

通过 **左侧边栏全局工具栏**（与「运行中项目」相邻的网格图标）或 **Ctrl+5** 打开 **可拖动的悬浮会话画板窗口**（交互对齐 `DraggableSettingsWindow`），以网格卡片形式总览所有 Agent / Shell 会话。画板 **不再** 占用主内容区 Tab 栏，也不遮挡整屏主内容。

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
| 替代 `RunningProjectsPopover` | 弹窗保留列表/搜索场景；画板是全局覆盖层总览 |

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

1. **全局入口「会话画板」**
   - 左侧边栏顶栏工具区：`LayoutGrid` 按钮（`SessionCanvasToolbarButton`），与仓库列表/刷新/运行中项目/折叠并列
   - 快捷键：`Ctrl+5`（`switchToCanvas`）切换覆盖层开关
   - 覆盖主内容区（不含侧栏），`Esc` 或关闭按钮退出

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

### 组件结构（当前实现）

```
App.tsx
├── TreeSidebar / RepositorySidebar 顶栏
│   └── SessionCanvasToolbarButton     # LayoutGrid，全局入口
├── MainContent                        # Agent / File / Terminal（无 canvas Tab）
└── DraggableSessionCanvasWindow       # createPortal → 可拖动悬浮窗（同设置窗）
    └── SessionCanvasPanel (variant=floating)
        └── SessionCanvasCard[]
```

### 已实现文件

| 文件 | 职责 |
|------|------|
| `components/canvas/SessionCanvasPanel.tsx` | 画板主面板（搜索、网格、聚焦） |
| `components/canvas/SessionCanvasCard.tsx` | 单张卡片 |
| `components/canvas/SessionCanvasPreview.tsx` | 只读终端风格预览 |
| `components/canvas/SessionCanvasOverlay.tsx` | 主内容区覆盖层 + Esc 关闭 |
| `components/canvas/SessionCanvasToolbarButton.tsx` | 侧栏顶栏切换按钮（含会话数角标） |
| `lib/terminalPreview.ts` | 预览文本截断（去 ANSI） |

### 关键修改点

| 文件 | 变更 |
|------|------|
| `App.tsx` | `isSessionCanvasOpen` 状态；包裹 MainContent + Overlay |
| `TreeSidebar.tsx` / `RepositorySidebar.tsx` | 顶栏画板按钮 |
| `App/constants.ts` | **已移除** `TabId` 中的 `'canvas'` |
| `App/useAppKeyboardShortcuts.ts` | `Ctrl+5` → `onToggleSessionCanvas`（非切 Tab） |
| `App/storage.ts` | 旧 `canvas` Tab 持久化迁移为 `chat` |
| `stores/agentSessions.ts` + `AgentTerminal.tsx` | Agent 预览管线 |
| `stores/terminal.ts` + `ShellTerminal.tsx` | Shell 预览管线 |
| `shared/i18n.ts` | `Session Canvas`、`Toggle session canvas` 等 |

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

| 能力 | Running Projects 弹窗 | 会话画板（全局覆盖层） |
|------|----------------------|------------------------|
| 入口 | 侧栏波形图标弹窗 | 侧栏网格图标 / `Ctrl+5` |
| 布局 | 列表 + 搜索 | 网格卡片 + 文本预览 |
| 聚焦逻辑 | `handleSelectItem` | 同：`onSelectWorktreeByPath` + 切 `chat`/`terminal` |
| 关闭全部 Agent/Terminal | 支持 | 首版未做 |

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

### 全局入口（侧栏顶栏）

- 图标：`LayoutGrid`（`SessionCanvasToolbarButton`）
- 位置：树形/分栏布局左侧边栏顶栏，在「运行中项目」与「折叠」之间
- 文案：**会话画板**（`Session Canvas`）
- 角标：当前 Agent + Shell 会话总数

---

## 实现阶段建议

### Phase 1（MVP — 方案 A）

- [x] `SessionCanvasPanel` + 卡片网格
- [x] Agent/Terminal 列表与点击聚焦（聚焦后自动关闭覆盖层）
- [x] Agent + Shell 预览文本管线
- [x] 基础 i18n + `Ctrl+5` 切换覆盖层
- [x] **全局入口**：侧栏顶栏按钮 + `SessionCanvasOverlay`（非主 Tab）

### Phase 2（体验增强，仍属方案 A 范围）

- [x] Shell 终端预览文本
- [x] 顶部搜索/筛选
- [ ] 按 worktree 分组标题
- [x] `switchToCanvas` 快捷键与设置项（切换覆盖层）

### Phase 3（体验 — 用户 2026-06-01 反馈）

- [x] 预览乱码修复：合并缓冲后剥离 ANSI/OSC，跨 chunk 保留未完成 ESC（v0.2.48）
- [x] 点击卡片跳转后**不自动关闭**画板（可继续总览其他会话）
- [x] 侧栏按钮提示 `Ctrl+5`
- [ ] 卡片自由拖拽布局（`@dnd-kit`）
- [ ] 卡片拖大/缩小
- [ ] 画板内直接输入（需全局终端宿主，见 Phase 4）
- [ ] 画板内快捷键在会话间跳转（1–9 等）

### Phase 4（方案 C，仅必要时）

- [ ] 全局终端宿主重构，画板内 live 多终端 + 可交互输入

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
| 画板覆盖层 | `src/renderer/components/canvas/SessionCanvasOverlay.tsx` |
| 侧栏入口按钮 | `src/renderer/components/canvas/SessionCanvasToolbarButton.tsx` |
| App 状态与布局 | `src/renderer/App.tsx` |
| 侧栏顶栏 | `src/renderer/components/layout/TreeSidebar.tsx` |
| 设计规范 | `docs/design-system.md` |

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-01 | 初稿：确认采用方案 A，记录范围、架构与实现清单 |
| 2026-06-01 | 画板从主 Tab 拆出，改为侧栏全局入口 + 主内容覆盖层（v0.2.47） |
