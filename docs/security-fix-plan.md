# 安全修复路线（2026-10-22）

> 结论：近几天 Next.js / React / Node.js / Caddy 的安全公告已逐项对照本项目。
> **应用层**（Next.js 16.4.2、React 19.3.1、sharp 0.35.5、js-yaml 3.15.2）均在修复线之上；
> 需要处理的是**运行环境层**——本机 Node v24.18.0 低于 24.22.1，Caddy 镜像停留在 2.10 系列。
> 本文按优先级给出修复动作、命令与验收方式，不涉及业务代码改动。

核对时间：2026-10-22
核对范围：`package.json` / `pnpm-lock.yaml` / `Dockerfile` / `docker-compose.yml` / `deploy/Caddyfile`

## 本轮修复记录（2026-10-22）

本文后续版本表保留的是修复前基线。以下状态以本轮代码和实际验收为准：

- Docker 的 base / runner 已共用 `NODE_VERSION=24.22.1`；Caddy 已固定为 `2.11.7-alpine`。这两个标签已核对 Docker 官方镜像清单，并在 VPS 上完成 Linux 构建与运行验收。
- `.node-version`、`.nvmrc` 和 `package.json#engines` 已声明 Node 24.22.1 基线。本机系统 Node 仍是 24.18.0；已下载官方 24.22.1 便携运行时并校验 SHA-256，本轮验证使用它执行。
- 官方 Windows 安装包已下载到 `.tools/node-v24.22.1-x64.msi`，SHA-256 与官方发布页一致，Authenticode 签名为有效的 OpenJS Foundation。当前进程没有管理员权限，系统级安装仍待管理员运行。
- 发布审计使用 `pnpm audit:release`（官方源，仅 HIGH / CRITICAL 阻断）；`pnpm audit:prod` 展示完整结果。当前仍有 1 项 `sprintf-js` 中危，没有 HIGH / CRITICAL。
- SVG 原生解码已在上传模块初始化时禁用；回归验证覆盖 SVG 元数据读取拒绝、普通图片转 WebP、尺寸限制、元数据移除与非法路径。
- 已补全 pnpm 的 sharp/libvips 原生依赖追踪。独立复制生产包到系统临时目录，实际验证原生编码、`/uploads` WebP 字节与响应类型、后台 307 跳转、`/healthz` 故障与恢复，以及容器健康脚本。
- 新 `/healthz` 检查真实数据目录读写和基础 JSON；备份设置远端却无法同步时非零退出，并保留本地新旧备份。恢复说明已改为停服务后整目录替换，保留旧数据回滚副本。
- Node 24.22.1 下 `pnpm check:release` 退出 0：类型检查、无告警生产构建、15 项功能测试、1 项独立生产包集成测试、发布审计均通过。Linux Docker 与公网域名检查不包含在此结果中。
- Git 已有基线提交 `52e6169`；远程仓库仍为空。未创建或推送外部仓库，也未公开文章与测试草稿。
- 后续已在用户 VPS 完成 Linux Docker 构建与 SSH 隧道 HTTPS 预览验收，含实际登录、上传、容器重启和备份恢复比对。详见 `docs/vps-preview.md`；尚未绑定公网域名，也未配置异地备份或监控。

运行时版本来源：[Node 24.22.1 发布页](https://nodejs.org/en/blog/release/v24.22.1)、[Node 官方镜像清单](https://raw.githubusercontent.com/docker-library/official-images/master/library/node)、[Caddy 官方镜像清单](https://raw.githubusercontent.com/docker-library/official-images/master/library/caddy)。

---

## 1. 版本基线

| 组件 | 当前版本 | 安全线 | 判定 |
|---|---|---|---|
| Next.js | 16.4.2 | ≥ 16.4.1（10-14 公告修复版） | ✅ 已覆盖 |
| React / React DOM | 19.3.1 | ≥ 19.2.4 / 19.1.5 / 19.0.4 | ✅ 已覆盖 |
| sharp | 0.35.5（librsvg 2.63.2） | = 0.35.5（CVE-2026-96889 修复版） | ✅ 已覆盖 |
| js-yaml（gray-matter 依赖） | 3.15.2 | ≥ 3.15.2（3.x 线最高修复） | ✅ 已覆盖 |
| sprintf-js（argparse 依赖） | 1.0.3 | ≥ 1.1.4 | ⚪ 不可达，仅 CLI 链路 |
| **Node.js（本机开发）** | **v24.18.0** | **≥ 24.22.1** | ⚠️ 待升级 |
| **Node.js（镜像）** | 浮动 `node:24-bookworm-slim` | 固定 24.22.1 | ⚠️ 待固定 |
| **Caddy（镜像）** | `caddy:2.10-alpine` | ≥ 2.11.5，建议 2.11.7 | ⚠️ 待升级 |

审计方法：`pnpm audit --prod --registry=https://registry.npmjs.org` 与 OSV API 全量核对 lockfile 中 228 个包。
注意：npmmirror 没有 audit 端点，`pnpm audit` 必须显式指定官方源，否则报 `ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS`。

---

## 2. P0 · 上线前必须处理

### P0-1 固定并升级 Node.js 运行时

**依据**：[Node.js 2026-10-21 安全发布](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)，
24.x 线修复版为 **v24.22.1**，包含 Brotli 解码越界写（CVE-2026-111497，HIGH）、
TLS 主机名校验绕过（CVE-2026-105483 / CVE-2026-106069，HIGH）等。本机开发环境为 v24.18.0，受影响。

**做法**

1. 本机升级到 24.22.1（nvm-windows / volta / 安装包任选）：

   ```powershell
   nvm install 24.22.1
   nvm use 24.22.1
   node -v   # v24.22.1
   ```

2. 镜像内改为固定补丁版本，避免浮动 tag 拉到哪个补丁版不可复现。
   `Dockerfile` 的 base 与 runner 两处 `FROM` 同步修改，建议用 ARG：

   ```dockerfile
   ARG NODE_VERSION=24.22.1
   FROM node:${NODE_VERSION}-bookworm-slim AS base
   # ...
   FROM node:${NODE_VERSION}-bookworm-slim AS runner
   ```

**验收**

```sh
docker compose build
docker compose exec blog node -v            # v24.22.1
docker compose exec blog node -e "console.log(require('sharp').versions.vips)"  # 8.18.7
```

### P0-2 升级 Caddy 反向代理

**依据**：2.11.3 / 2.11.4 / 2.11.5 连续修复了
CVE-2026-45135（FastCGI 路径切分导致 RCE）、CVE-2026-45692（remote admin `/config` 越权）、
CVE-2026-52844/52845/52846（Windows 路径绕过、forward_auth 头注入、模板 XSS）、
CVE-2026-55458（WebSocket 101 响应未剥离 hop-by-hop 头）、GHSA-6365（forward_auth + reverse_proxy 连接错配）。
当前 `caddy:2.10-alpine` 已不在补丁线。

**可达性说明**：本项目 `deploy/Caddyfile` 只使用 `reverse_proxy` 与 `file_server`，
未配置 FastCGI、`forward_auth`、模板函数和 remote admin。WebSocket 升级由 `reverse_proxy` 自动处理，
不能仅根据没有显式 WebSocket 配置就判定相关漏洞不可达；还需检查上游是否能返回 HTTP 101。
已固定到 2.11.7，以覆盖相关修复和 2.11.6 的 HTTP/2 回归修复，部署后仍需检查实际运行版本。

**做法**：`docker-compose.yml`

```yaml
caddy:
  image: caddy:2.11.7-alpine
```

**验收**

```sh
docker compose pull caddy
docker compose up -d caddy
docker compose exec caddy caddy version   # v2.11.7
curl -sI https://你的域名 | grep -i strict-transport-security
```

### P0-3 建立 Git 基线

**当前状态**：已有基线提交；仓库仍没有 remote，`DEPLOY.md` 的 `git clone` 与服务器 `git pull` 流程尚不能验收。

**做法**

```sh
# 先检查待提交内容，尤其不要纳入 .env、图片、评论和会话数据。
git status --short
git diff --stat
git remote add origin <远程仓库地址>
git push -u origin main
```

**验收**：`git status` 干净；`git log --oneline` 可读；临时目录 `git clone` 后 `pnpm install --frozen-lockfile && pnpm build` 通过。

> 注意：`data/posts/*.md` 已改为入库（含 `111.md` 测试草稿）；若远程仓库公开，请先确认是否要把草稿与示例数据一起公开。

---

## 3. P1 · 发布前检查与加固

### P1-1 把依赖审计纳入发布流程

每次升级依赖或发布前执行：

```sh
pnpm audit --prod --registry=https://registry.npmjs.org
```

- 必须带 `--registry`：国内镜像源没有 audit 端点。
- 关注 HIGH / CRITICAL；MODERATE 先判断可达性（如 sprintf-js 只经 `js-yaml` 的 CLI 参数解析，服务端运行时不加载）。
- 需要全量、含传递依赖时，可对 lockfile 逐包查 OSV：`POST https://api.osv.dev/v1/query`，参数 `{package:{name,ecosystem:"npm"},version}`。

### P1-2 sharp 解码面纵深防御（可选）

上传白名单已排除 SVG（仅 jpeg/png/webp/gif/avif/heif/tiff），且所有上传会重编码为 WebP。
本轮已在 `lib/uploads.ts` 初始化处禁用 SVG 解码：

```ts
import sharp from "sharp";
sharp.block({ operation: ["VipsForeignLoadSvg"] });
```

影响面：仅禁止 SVG 输入；`metadata()` 对 SVG 的处理也会被拒绝，符合当前「不支持 SVG 上传」的产品约定。

### P1-3 安全头复核（已具备，部署后验证）

`proxy.ts` 已生成逐请求 nonce 的 CSP（含 `frame-ancestors 'none'`、生产 `upgrade-insecure-requests`）；
`next.config.ts` 带 nosniff / Referrer-Policy / X-Frame-Options / Permissions-Policy；
Caddy 追加 HSTS 并隐藏 `Server`。上线后抽查：

```sh
curl -sI https://你的域名 | grep -iE "content-security-policy|strict-transport-security|x-content-type-options"
```

---

## 4. P2 · 运维常态

1. **镜像重建**：Node/Caddy 镜像的安全修复只在重新构建时生效。建议每月执行一次
   `docker compose pull && docker compose up -d --build`，或固定在备份窗口后执行。
2. **备份**：`deploy/backup.sh` 已保留 14 份；仍需异地副本，并在上线第一周做一次恢复演练。
3. **监控**：外部探活使用 `/healthz`，验证 Node、数据目录读写与基础配置数据；`/robots.txt` 仅验证 SEO 路由响应，不能证明数据卷可用。异常通知渠道由部署者配置。
4. **会话与凭据**：`.env` 单独备份到密码管理器；`BLOG_SESSION_SECRET` 轮换会使所有设备重新登录。
5. **复查节奏**：每月扫一次依赖审计；Next.js / Node.js / Caddy 发布安全公告时按本文第 1 节对照版本。

---

## 5. 复查清单（每次升级照着勾）

- [ ] `pnpm audit --prod --registry=https://registry.npmjs.org` 无 HIGH / CRITICAL
- [ ] `next` 不低于当前 Active LTS 的安全版（本次基线 16.4.1）
- [ ] `sharp` 不低于 0.35.5；镜像内 `require('sharp')` 正常
- [ ] 本机与镜像 Node 版本一致且 ≥ 24.22.1
- [ ] `caddy version` ≥ 2.11.5
- [ ] 上传一张图片 → 前台 `/uploads/...` 返回 200 且 `Content-Type: image/webp`
- [ ] 未登录访问 `/admin` 307 到 `/login`；登录后 Cookie 为 `Secure; HttpOnly`
- [ ] CSP、HSTS、nosniff 头存在
- [ ] `pnpm typecheck` 与 `pnpm build` 通过

---

## 6. 公告来源

- Next.js 10-14 安全更新：<https://nextjs.org/blog/nextjs-security-update-october-14-2026>
- Next.js / React 汇总（Netlify）：<https://www.netlify.com/changelog/2026-10-14-nextjs-react-security-vulnerabilities/>
- CSA 警报（10-20）：<https://www.csa.gov.sg/alerts-and-advisories/alerts/al-2026-148/>
- sharp / librsvg CVE-2026-96889：<https://github.com/advisories/GHSA-wq5f-xc86-pv6w>
- Node.js 10-21 安全发布：<https://nodejs.org/en/blog/vulnerability/october-2026-security-releases>
- Caddy 安全公告：<https://github.com/caddyserver/caddy/security/advisories>

---

*本文与 `docs/deploy-review.md` 互补：后者是上线评审清单，本文是版本安全与修复路线。*
