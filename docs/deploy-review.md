# VPS 上线评审与改进清单

评审时间：2026-10-19
评审对象：`self_blog`（Next.js 16 + 文件存储，Docker + Caddy 部署）
结论：**架构与安全基线适合单机 VPS，但有 4 项上线阻塞，必须先处理。**

本文件只列待改进项与验收方式，不重复 `DEPLOY.md` 的操作步骤。

## 当前进度（2026-10-22）

以下评审正文保留原始发现，不能把每项都视为当前仍未修复。当前代码核查结果：

- 已落地：Git 基线提交、构建 registry 参数、workspace 配置复制、文章缓存、Caddy 图片直出、构建上下文裁剪、文章入库、CSP、日志封顶、只读根文件系统与健康依赖。
- 本轮已落地：固定 Node/Caddy 版本、pnpm standalone 的 sharp 原生依赖追踪、独立数据健康检查、SVG 解码阻断和异地备份失败报告。
- 仍需外部条件验收：远程仓库地址与推送、真实公网域名与证书、异地备份与日常监控。
- 本机没有 Docker；Linux 验收在 VPS 执行。具体命令与本轮结果见 `DEPLOY.md` 和 `docs/security-fix-plan.md`。
- 后续已在 VPS 上通过 Linux 镜像、sharp 上传、Secure Cookie、重启持久化与备份恢复校验；部署为 SSH 隧道预览，尚无公网域名。实际部署记录见 `docs/vps-preview.md`。

---

## 优先级总览

| 级别 | 含义 | 数量 |
|---|---|---|
| P0 | 不处理就无法上线，或上线即坏 | 4 |
| P1 | 上线后第一批，直接影响运维与体验 | 5 |
| P2 | 可选加固与优化，不着急 | 6 |

---

## P0 · 上线前必须处理

### P0-1 仓库没有 remote，51 个文件未提交

- **现象**：`git remote -v` 为空；只有 1 个初始 commit；工作区 51 项改动未提交；`data/posts/*` 除 `hello-world.md` 外被忽略（`.gitignore`:39）。
- **影响**：`DEPLOY.md`:13 的 `git clone <你的仓库>` 无法执行，服务器上的 `git pull` 更新流程也不存在。
- **做法**：建远程仓库 → 提交当前工作区 → 决定文章内容是否入库（见 P1-5）。
- **验收**：在临时目录 `git clone` 一份，能跑通 `pnpm install --frozen-lockfile && pnpm build`。

### P0-2 1C1G 机器构建大概率 OOM

- **现象**：构建发生在镜像内（`Dockerfile`:17 `pnpm build`）。Next 16 + Turbopack 构建内存峰值经验值在 1–1.5GB，1C1G 机器几乎必然被 OOM killer 打断。
- **影响**：`docker compose up -d --build` 在低配 VPS 上失败，且报错信息容易被误读成代码问题。
- **做法**（三选一，按推荐度排序）：
  1. VPS 选 2C2G；
  2. 1C1G 上加 2G swap（`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`，并写入 `/etc/fstab`）；
  3. 本地或 CI 构建镜像后 `docker save | ssh ... docker load` 推上去，VPS 只跑不构建。
- **验收**：在目标机上 `docker compose build` 一次跑完，`dmesg | grep -i oom` 无记录。

### P0-3 国内 VPS 拉包会卡在 corepack / pnpm

- **现象**：`Dockerfile`:5 `corepack enable` 和 `deps` 阶段的 `pnpm install` 都走默认 `registry.npmjs.org`。锁文件是 integrity-only（不含 tarball URL），所以换源不影响锁文件校验。
- **影响**：构建可能长时间卡住或超时失败；表现是"docker build 没输出"。
- **做法**：在 Dockerfile 的 `base` 阶段加：

  ```dockerfile
  ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
  ```

  在 `deps` 阶段 `pnpm install` 前加：

  ```dockerfile
  RUN pnpm config set registry https://registry.npmmirror.com
  ```

  海外 VPS 不需要这步。
- **验收**：`docker compose build` 从零开始 5 分钟内完成依赖安装。

### P0-4 sharp 的 Linux 原生依赖未被验证

- **现象**：本地用 `node .next/standalone/server.js` 起生产服务，首页、文章页、`/feed.xml`、`/sitemap.xml`、`/login` 全部 200，`/admin` 正确 307 到登录；但 `/uploads/*` 和 `/api/upload` 直接 500。原因是 Windows 上 `@vercel/nft` 不做 ldd 分析，`libvips` 的 DLL 没被 trace 进 standalone（`.next/standalone` 里 `.dll` 数量为 0），`sharp` 加载失败。
- **影响**：Linux 上 nft 会走 ldd，理论上正常，但**尚未在 Linux 环境验证**。若同样缺失 `.so`，则图片上传和所有图片访问全挂——这是上线后最贵的故障。
- **做法**：
  1. 部署后立即执行 `docker compose exec blog node -e "console.log(require('sharp').versions)"`；
  2. 若失败，在 `next.config.ts` 加兜底：

     ```ts
     outputFileTracingIncludes: {
       "/api/upload": ["./node_modules/@img/**/*"],
       "/uploads/[...path]": ["./node_modules/@img/**/*"],
     },
     ```

  3. 把 sharp 自检并进 `Dockerfile`:29 的 HEALTHCHECK，让坏镜像永远进不了 `healthy` 状态。
- **验收**：后台上传一张图成功，前台 `/uploads/...` 返回 200 且 `Content-Type: image/webp`。

---

## P1 · 上线后第一批

### P1-1 全站 24 个路由 `force-dynamic`，每次请求重读全部 md

- **现象**：24 个页面/路由文件都声明了 `force-dynamic`；`readAll()`（`lib/posts.ts`:57）每次调用都 `readdir` + 读所有文章文件 + gray-matter 解析。文章页一次请求会多次调用（正文、相关文章、系列、相邻文章）。
- **影响**：7 篇时无感；100 篇以上遇到爬虫并发，1 核机器会明显变慢。
- **做法**：在 `lib/posts.ts` 加模块级缓存，用文章目录 mtime 做失效判断；`savePost`/`deletePost` 后主动清空。不引入数据库，不改变"文件即内容"。
- **验收**：压测 50 并发下首页 P95 明显下降；发布文章后前台立即可见。

### P1-2 图片绕 Node 一圈才吐出来

- **现象**：`app/uploads/[...path]/route.ts`:20 每次请求 `fs.readFile` 整个文件再返回。
- **影响**：图片流量全部压在 Node 上；文章配图多的页面并发一高就吃 CPU。
- **做法**：Caddy 直接 `file_server` 提供 `data/uploads`（compose 里把 `./data/uploads` 只读挂进 caddy 容器），Next 路由保留作兜底。
- **验收**：`curl -I https://域名/uploads/...` 响应头来自 Caddy，且 Node 进程 CPU 不随图片请求上涨。

### P1-3 `.dockerignore` 漏排大目录

- **现象**：`.dockerignore` 已排除 `.agents/`，但漏了 `docs/`（33MB）、`.tools/`（7.2MB）、`.tmp-shot/`、`plugins/`、`*.tsbuildinfo`。
- **影响**：每次构建多传 40MB+ 上下文，构建变慢；`docs/design-references/*.md` 还会被 trace 进 standalone。
- **做法**：补 `docs`、`.tools`、`.tmp-shot`、`plugins`、`*.tsbuildinfo`。
- **验收**：`docker build` 日志里 "transferring context" 明显变小。

### P1-4 备份只在本机，且不含 `.env`

- **现象**：`deploy/backup.sh`:8 打包 `data/` 到 `deploy/backups/`，保留 14 份，全部在同一块磁盘；`.env` 不在备份内。
- **影响**：VPS 磁盘故障 = 内容全丢；换机器要重填三个密钥，且历史备份无法直接恢复成可用站点。
- **做法**：
  1. 加 crontab 每日执行（`0 4 * * * cd /opt/self_blog && sh deploy/backup.sh`）；
  2. 用 `rclone` 或 `rsync` 同步一份到对象存储 / 另一台机器；
  3. `.env` 单独备份到密码管理器，不要和 `data/` 放一起；
  4. 上线第一周做一次**恢复演练**（解包到临时目录，比对文章数）。
- **验收**：`ls deploy/backups/` 有当日包；异地存储里有副本；恢复演练成功。

### P1-5 文章内容不在版本控制里

- **现象**：`.gitignore`:35-40 忽略 `data/uploads/`、`comments.json`、`sessions.json`、`settings.json`，`data/posts/*` 只保留 `hello-world.md`。`data/projects.json` 已移出忽略列表，但仍未提交。
- **影响**：文章只存在于本机磁盘和服务器磁盘；误删、误改无历史可回滚。这与"档案站"的定位不匹配。
- **做法**（二选一）：
  1. 文章入库（去掉 `data/posts/*` 忽略），服务器上改为"只读内容 + 后台写入"会有 git 冲突，需要想清楚；
  2. 保持不入库，但把备份升级为**带时间戳的增量版本**（如 git 仓库只存 `data/`，每天 commit 一次），成本更低。
- **验收**：能查到任意一篇文章 30 天前的版本。

---

## P2 · 可选加固

### P2-1 `withLock` 只保证单进程串行

`lib/store.ts`:31-33 的锁是进程内 Map。单容器没问题，**但不要扩多副本**；将来若要扩，必须换成 SQLite/Redis。写进运维备注即可。

### P2-2 `pnpm-workspace.yaml` 没进构建阶段

`Dockerfile`:9 只 COPY `package.json` + `pnpm-lock.yaml`，漏了 `pnpm-workspace.yaml`（含 pnpm 11 的 `minimumReleaseAgeExclude`）。当前无影响，但以后在里面加 `onlyBuiltDependencies` 之类配置时，本地与镜像行为会分叉。补一行 COPY。

### P2-3 缺 CSP 响应头

`next.config.ts`:3 只有 nosniff / Referrer-Policy / X-Frame-Options / Permissions-Policy。加 CSP 前需处理内联主题脚本（`app/layout.tsx`:31）——用 nonce 或 hash，否则会白屏。

### P2-4 Docker 日志会无限增长

`docker-compose.yml` 没有 logging 配置，默认 json-file 无上限。补：

```yaml
logging:
  driver: json-file
  options: { max-size: "10m", max-file: "3" }
```

### P2-5 容器可再收紧

`blog` 服务可加 `read_only: true`（`/app/data` 与 `/tmp` 例外）、`security_opt: [no-new-privileges:true]`、`init: true`。另外 `caddy` 的 `depends_on` 可改成 `condition: service_healthy`，避免启动瞬间 502。

### P2-6 无可用性监控

原评审建议使用 `/robots.txt`，但本轮发现它只生成 SEO 规则，不检查数据目录。现已增加 `/healthz`，检查实际数据目录读写与基础 JSON；外部探活应使用该地址，通知渠道由部署者配置。

---

## 上线当天验收清单

按顺序执行，任一项不过就停下排查：

- [ ] `docker compose config` 能渲染，`DOMAIN` 已替换
- [ ] `docker compose up -d --build` 成功，`dmesg` 无 OOM
- [ ] `docker compose ps` 两个服务都是 `healthy` / `running`
- [ ] `curl -I https://域名` 返回 200，带 `Strict-Transport-Security`
- [ ] 未登录访问 `/admin` 跳 `/login`
- [ ] 登录成功，浏览器 cookie 为 `Secure; HttpOnly`
- [ ] **上传一张图片成功**，`/uploads/...` 返回 200（P0-4）
- [ ] 新建 / 编辑 / 删除文章各一次，前台立即生效
- [ ] 提交一条评论 → 后台「评论」能看到待审核
- [ ] `/feed.xml`、`/sitemap.xml` 中的链接是真实域名（`SITE_URL` 生效）
- [ ] `sh deploy/backup.sh` 生成 tar，解包后文章数一致
- [ ] `docker compose restart blog` 后内容仍在

---

## 附：本次评审的验证范围

**已验证**
- `pnpm install --frozen-lockfile` 通过；`pnpm build` 通过
- 在**没有 `.env.local`、没有 `data/`** 的条件下 `pnpm build` 仍通过（等价 Dockerfile 构建阶段）
- 以 standalone 方式启动生产服务，前台/文章/RSS/sitemap/login 均 200，`/admin` 307
- 反向代理、安全头、限流、路径穿越防护、XSS 转义等代码层审查
- 2026-10-22：Node 24.22.1 下 `pnpm check:release` 通过；15 项功能测试与 1 项隔离生产包集成测试通过，sharp Windows 原生编码、图片响应、认证跳转与健康状态故障恢复均实际执行。

**未验证（受环境限制）**
- 本机没有 Docker，**镜像构建与容器运行未实测**
- Linux 下 sharp 的 `.so` 是否被正确 trace（见 P0-4）
- Caddy 证书签发、HTTP/3、真实域名下的 cookie 行为
