# Windows 便携版发布（hlleng/orca）

`fork-portable` 保存便携版补丁和构建脚本。fork 默认分支需要有
`.github/workflows/fork-portable.yml` 及其引用的上游
`qualified-orcad-template.yml`。只需把入口工作流复制到默认分支。
保持 `fork-portable` 以脚本里的固定基线为起点；每次发布会把它的便携版改动应用到上游稳定 tag。
上游 PR 仍使用原分支。GitHub Actions 需要在 fork 中启用，并允许工作流写入发布用分支、tag 和 Release。

## 首次启用

仓库变量 `PORTABLE_PUBLIC_KEY` 和 Environment `portable-release` 下的 secret
`PORTABLE_PRIVATE_KEY` 使用同一对 Ed25519 PEM 密钥。已配置时复用原密钥。
首次可以在已登录该 fork 管理账号的 Bash 终端执行以下命令。
私钥备份保存在新建的本机目录，请妥善保存。

```bash
(
  set -eu
  umask 077
  keys="$HOME/.orca-portable-signing"
  mkdir "$keys"
  openssl genpkey -algorithm ED25519 -out "$keys/private.pem"
  openssl pkey -in "$keys/private.pem" -pubout -out "$keys/public.pem"
  gh api -X PUT repos/hlleng/orca/environments/portable-release
  gh secret set PORTABLE_PRIVATE_KEY -R hlleng/orca --env portable-release < "$keys/private.pem"
  gh api -X POST repos/hlleng/orca/actions/variables -f name=PORTABLE_PUBLIC_KEY -F "value=@$keys/public.pem"
)
```

从 `v1.4.269` 开始跟踪。可以在首次运行前设置仓库变量 `PORTABLE_FIRST_TAG`
为另一个已存在的上游稳定 tag。默认每半小时选择最早尚未发布的稳定 tag，一次一个。
首次发布同样可以手动触发：

```bash
gh workflow run fork-portable.yml -R hlleng/orca -f tag=v1.4.269
```

## 发布与验收

工作流将上游提交和公钥固定在 `portable-builds/<tag>-<sha>`，在 Windows x64 构建，
使用合格的远程服务器模板，解压真实 ZIP，并运行原生更新器验证程序替换和用户数据保留。
签名任务单独运行。它核对 ZIP 的 SHA-256，用私钥签署 UTF-8 字节
`<tag>\n<完整 .sha256 文件内容>`，并生成 electron-updater 使用的 `latest.yml`。
通过后创建指向构建提交的同名 tag，将 ZIP、校验文件、签名和清单上传至草稿，再公开 Release。
补发旧版会保留较高版本的 Latest 标记。

补丁冲突时，在配方分支调整补丁后重跑。已发布版本会跳过，已存在且指向不同提交的 tag 会报错。
如果上传中断，可在相同配方和公钥下重跑同一 tag 以补全草稿。fork 专用签名覆盖整个更新包；
Windows 对首次启动的 EXE 仍按其自身 Authenticode 状态处理。

首次从 fork Release 下载 ZIP，解压到可写目录后启动 `Orca.exe`。沿用原有便携用户数据时先退出旧版，
保留并备份原 `data` 目录。旧版使用的若是自定义 `--user-data-dir`，迁移时沿用实际的配置目录。
发布第二个版本后，在旧版执行“检查更新”，下载、重启，核对应用版本及原有设置。
