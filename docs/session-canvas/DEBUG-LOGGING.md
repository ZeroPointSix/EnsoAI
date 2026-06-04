# Session Canvas 调试日志

统一前缀：**`[SessionCanvas]`**

## 开启方式

1. 设置 → 开启日志（`loggingEnabled`）
2. 日志级别 **debug**
3. DevTools 过滤：`SessionCanvas`
4. 文件：`%APPDATA%/EnsoAIPlus Dev/logs/ensoai-*.log`

## Area 标签

| Area | 模块 |
|------|------|
| Activity | `agentRuntimeActivity` 状态机 |
| Monitor | 主窗 `useAgentRuntimeActivityMonitor` |
| Snapshot / Sync | 快照构建与 IPC 推送 |
| App | 主窗看板开关与同步循环 |
| Panel / Focus / Click | 面板与聚焦 |
| Card | 独立窗卡片灯色展示 |
| Drag / Resize | 拖动与缩放 |
| HookDisplay | 主窗 Hook store |
| Hook | 主进程 `ClaudeIdeBridge` |
| Standalone | 独立看板进程 |
| QuickInput / PtyCheck / PtyRegistry / Preview | 输入、PTY、预览 |
| IPC / Window | 主进程 IPC 与窗口 |

## 限流

`sessionCanvasLogThrottled`：poll 汇总 2s、onData 3s/会话、预览刷新 3s，避免刷屏。

## 审查问题对照 grep

```text
phase running → completed     # 黄绿闪
branch activity + working       # 授权不红
AskUserQuestion / PermissionRequest  # Hook 主进程
disableDragAll / enter overlay  # 拖动与聚焦
useInputPanel false             # 输入框变小
```
