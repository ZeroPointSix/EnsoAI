# EnsoAIPlus Dev 分支说明

本分支用于日常功能开发与 CI 测试安装包，与正式版 **EnsoAIPlus** 完全隔离：

| 项 | 正式版 `main` | 开发版 `dev` |
|----|---------------|--------------|
| 应用名 | EnsoAIPlus | **EnsoAIPlus Dev** |
| AppId | `com.ensoaiplus.app` | `com.ensoaiplus.dev.app` |
| 深链协议 | `enso://` | **`enso-dev://`** |
| 用户数据目录 | `%AppData%/EnsoAIPlus` | `%AppData%/EnsoAIPlus Dev` |
| CI 产物 | `windows-installer` | `windows-installer-dev` |

安装 Dev 版后不会抢占正式版单实例，也不会因 `enso://` 注册冲突而跳转到正式程序。

后续功能开发请提交到 **`dev`** 分支；稳定后再合并到 `main` 发正式版。
