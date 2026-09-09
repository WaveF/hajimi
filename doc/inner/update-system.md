# hajimi 更新系统设计参考

本文记录 hajimi 后续“检测更新”和“自动更新”的评估结果，作为未来开发更新功能时的实现参考。

## 1. 结论

hajimi 使用 Tauri 2.x，可以接入 Tauri Updater。

GitHub Releases 可以直接作为公开更新源，不需要额外部署独立服务器。GitHub 负责托管更新包和静态更新描述文件，GitHub Actions 负责构建、签名并上传发布物。

这里的“热更新”应理解为应用版本更新，而不是网页前端资源的即时替换。更新安装后通常需要重启 hajimi，新的 Rust 后端、索引逻辑和前端资源才会完整生效。

## 2. 当前项目状态

当前项目已经具备：

- Tauri 2.x 桌面应用。
- `tauri.conf.json` 和 Cargo 包中的统一版本号。
- GitHub Releases 发布渠道。
- macOS `.dmg` 构建流程。
- GitHub Actions 前端和 Rust CI。

当前仍缺少：

- `tauri-plugin-updater` Rust 插件。
- `@tauri-apps/plugin-updater` 前端插件。
- Tauri updater 签名密钥及公钥配置。
- updater 专用构建物和 `latest.json`。
- 自动发布 Release 的 GitHub Actions workflow。
- 设置面板或关于面板中的更新检查、下载和安装 UI。

## 3. 两种功能范围

### 3.1 仅检测更新

流程：

1. 请求远端版本信息。
2. 将远端版本与当前版本进行 SemVer 比较。
3. 显示“发现新版本”。
4. 提供前往 GitHub Releases 的下载按钮。

这个方案实现成本低，适合第一阶段。可以直接读取公开 GitHub Releases API，也可以使用 Tauri updater 生成的静态 JSON。

需要注意 GitHub API 存在访问频率限制，因此长期方案更适合使用静态 `latest.json`。

### 3.2 自动下载安装

推荐使用 Tauri Updater：

1. 应用启动后或用户手动触发检查。
2. 请求 `latest.json`。
3. 比较当前版本和远端版本。
4. 显示更新说明和下载确认。
5. 下载 updater 包。
6. 验证 Tauri 签名。
7. 安装更新并提示重启，或由应用自动重启。

建议默认由用户确认下载和安装，不建议无提示强制更新。

## 4. GitHub Releases 更新源

公开仓库可以使用静态 endpoint：

```text
https://github.com/WaveF/hajimi/releases/latest/download/latest.json
```

`latest.json` 需要包含至少以下字段：

```json
{
  "version": "0.1.24",
  "url": "https://github.com/WaveF/hajimi/releases/download/v0.1.24/hajimi.app.tar.gz",
  "signature": "...",
  "notes": "更新说明",
  "pub_date": "2026-09-08T00:00:00Z"
}
```

GitHub Release 至少需要包含：

- 首次安装用的 `.dmg`。
- Tauri updater 使用的 `.app.tar.gz`。
- `.app.tar.gz.sig` 签名文件内容对应的签名。
- `latest.json`。

如果未来支持 Windows 或 Linux，需要为各平台和架构分别生成 updater 包，并在 `latest.json` 中提供对应目标。

Tauri 官方支持将 GitHub Releases 作为静态 JSON 更新源，也提供 GitHub Actions 发布方案：

- [Tauri Updater 官方文档](https://v2.tauri.app/plugin/updater/)
- [Tauri GitHub 发布流水线文档](https://v2.tauri.app/distribute/pipelines/github/)

## 5. Tauri 签名要求

Tauri updater 必须验证更新包签名，不能关闭签名校验。

需要生成一对 Tauri updater 密钥：

- 公钥：可以提交到仓库，并配置到 `tauri.conf.json`。
- 私钥：不得提交到仓库，应保存为 GitHub Actions Secret。

建议使用以下环境变量：

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

私钥丢失会导致已经安装旧版本的用户无法验证后续更新，因此需要安全备份。

## 6. Apple 签名与 Tauri 签名的区别

这两种签名解决的问题不同：

| 签名 | 作用 |
| --- | --- |
| Apple Developer ID | 影响 macOS Gatekeeper、notarization 和首次打开体验 |
| Tauri updater 签名 | 验证更新包是否来自 hajimi，并防止更新包被篡改 |

当前项目使用 ad-hoc 签名：

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "-"
    }
  }
}
```

这不妨碍接入 Tauri updater，但用户首次安装或更新时仍可能看到 macOS 安全提示。若希望获得更顺滑的自动更新体验，后续应考虑 Apple Developer ID 签名和 notarization。

## 7. 预计需要修改的文件

### Tauri 与依赖

- `cardinal/src-tauri/Cargo.toml`
- `cardinal/src-tauri/Cargo.lock`
- `cardinal/package.json`
- `cardinal/package-lock.json`
- `cardinal/src-tauri/src/lib.rs`
- `cardinal/src-tauri/tauri.conf.json`
- `cardinal/src-tauri/capabilities/default.json`

典型配置包括：

- 注册 `tauri_plugin_updater`。
- 增加 `updater:default` 权限。
- 设置 updater 公钥。
- 设置 GitHub `latest.json` endpoint。
- 开启 `bundle.createUpdaterArtifacts`。

### 前端 UI

可以在设置面板或关于面板增加：

- 当前版本号。
- “检查更新”按钮。
- “发现新版本”状态。
- 更新说明。
- 下载进度。
- 安装完成及重启提示。
- 检查失败、网络异常和用户取消状态。

如果需要程序主动重启，可能还需要接入 Tauri process 插件及对应权限。

### GitHub Actions

建议新增专门的 release workflow：

1. 由 `v*` tag 触发，或手动触发。
2. 安装项目要求的 Rust nightly 工具链。
3. 安装 Node.js 依赖。
4. 注入 Tauri 签名私钥。
5. 构建 macOS `.dmg` 和 updater 包。
6. 生成 `latest.json`。
7. 创建 GitHub Release 并上传所有资产。

现有 CI 主要用于检查和构建验证，不应直接把发布密钥加入普通 CI job。

## 8. 版本发布规则

建议使用 SemVer：

```text
0.1.23 -> 0.1.24
```

每次发布需要同步更新：

- `cardinal/src-tauri/tauri.conf.json` 的 `version`。
- `cardinal/src-tauri/Cargo.toml` 的 `version`。
- Git tag，例如 `v0.1.24`。

不要把 `latest.json` 指向 draft Release 或未发布的预览版本，除非明确设计 beta channel。

## 9. 推荐实施顺序

### 阶段一：更新检查

- 接入版本比较逻辑。
- 增加手动“检查更新”按钮。
- 使用 GitHub 静态 JSON 或 Releases API。
- 暂不自动下载和安装。

### 阶段二：签名发布物

- 生成并安全保存 updater 密钥。
- 开启 `createUpdaterArtifacts`。
- 本地验证签名包。
- 建立 tag 触发的 GitHub Release workflow。

### 阶段三：自动安装

- 接入 `tauri-plugin-updater`。
- 增加下载进度和安装状态。
- 安装前显示更新说明。
- 安装成功后提示重启。
- 验证旧版本到新版本的完整升级路径。

### 阶段四：分发质量提升

- 申请 Apple Developer ID。
- 配置 notarization。
- 增加稳定版和 beta channel。
- 增加失败回滚或手动下载兜底。

## 10. 最终建议

对于 hajimi，推荐使用：

```text
GitHub Releases
        +
Tauri Updater
        +
GitHub Actions 自动构建与签名
```

不建议为第一版更新功能单独部署服务器，也不建议通过远程加载前端资源实现“即时热更新”。后者无法可靠更新 Rust 后端、索引逻辑和原生能力，并且会增加安全和离线使用风险。

第一版可以先实现“手动检查更新 + 跳转 GitHub Releases”，确认发布流程稳定后，再增加签名下载和自动安装。
