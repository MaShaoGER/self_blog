# 部署到 VPS

需要：一台装了 Docker（含 compose 插件）的 Linux VPS，一个域名。

没有域名时，可使用专用 SSH 隧道 HTTPS 预览配置；本项目当前 VPS 的访问方式与验收记录见 `docs/vps-preview.md`。

> 只部署**单实例**：应用用进程内锁保证写入串行，不要扩多副本，详见第 9 节。

镜像固定 Node **24.22.1**、Caddy **2.11.7**；本地也使用 `.node-version` / `.nvmrc` 指定的 Node 版本。发布前运行 `pnpm check:release`，依次执行类型检查、构建、回归测试、独立生产包验证与 HIGH / CRITICAL 依赖审计。完整中危信息用 `pnpm audit:prod` 查看。

## 1. 域名解析

把域名（如 `blog.example.com`）的 A 记录指向 VPS 公网 IP。`www.` 子域名可选，配了会自动跳转到主域名。
防火墙放行 80、443（TCP）和 443（UDP，HTTP/3）。

## 2. 机器规格与 swap

镜像内要跑 `pnpm build`（Next.js 16），内存峰值约 1–1.5GB，1C1G 机器大概率被 OOM killer 打断。

- 首选 **2C2G** 及以上；
- 已有 1C1G：用 root 执行一次（幂等，默认加 2G，可用 `SWAP_SIZE_MB=4096` 调整）：

  ```sh
  sudo sh deploy/swap.sh
  ```

  构建后用 `dmesg | grep -i oom` 确认没有新记录。如果 `swapon --show` 显示云镜像已自带 swap，可直接跳过这一步。
- 不想在 VPS 上构建：本地或 CI 构建好镜像再推上去，VPS 只跑不构建：

  ```sh
  # 本机（有 Docker）
  docker compose build
  docker save self-blog:latest | gzip > self-blog.tar.gz
  scp self-blog.tar.gz root@你的VPS:/opt/self_blog/

  # VPS 上：镜像已 load，compose 不会再构建
  cd /opt/self_blog && gunzip -c self-blog.tar.gz | docker load
  docker compose up -d
  ```

swap 会让构建变慢，但比 OOM 失败好；2C2G 机器不需要这一步。

## 3. 上传代码并配置

```sh
git clone <你的仓库> /opt/self_blog && cd /opt/self_blog
cp .env.example .env
openssl rand -base64 48     # 生成的内容填到 BLOG_SESSION_SECRET
nano .env                   # 填 BLOG_ADMIN_PASSWORD、SITE_URL、DOMAIN

mkdir -p data/posts data/uploads
chown -R 1001:1001 data     # 容器内以 uid 1001 运行，需要能写 data/
```

`data/uploads` 必须提前建好并归 1001：它会被只读挂载给 Caddy 直出图片，目录不存在时 Docker 会以 root 自动创建，容器内 1001 就写不进去，上传会失败。

本地已有的文章，把 `data/` 整个拷到服务器同一位置即可。

## 4. 构建与启动

国内服务器建议先在 `.env` 里加一行（海外不用）：

```sh
NPM_REGISTRY=https://registry.npmmirror.com
```

也可以只对某次构建生效：`docker compose build --build-arg NPM_REGISTRY=https://registry.npmmirror.com`。不设则走官方源，行为与以前一致。

```sh
docker compose up -d --build
docker compose ps              # blog 应为 healthy，caddy 为 running
docker compose logs -f caddy   # 看到证书签发成功即可访问
```

Caddy 会等 `blog` 的 HEALTHCHECK 通过后再启动，避免启动瞬间 502。healthcheck 加载 sharp 并请求 `/healthz`；后者检查数据根目录、文章与上传目录的读取和临时文件写入/重命名，以及已存在的设置/项目 JSON 是否可解析。失败返回不含路径或内容的 503，“blog 一直 unhealthy”需要同时检查镜像和挂载权限。

打开 `https://你的域名/login` 登录后台。

首次初始化的用户名为 `admin`，密码沿用 `BLOG_ADMIN_PASSWORD`。账号信息在 `data/accounts.json`，密码存为 scrypt 哈希，不是明文。迁移到多人后台时旧会话需要重新登录；初始化后请在「我的账号」改自己的密码，在「账号管理」创建、停用或重置协作者账号。编辑可管理文章、图片和评论，只有管理员能改账号和站点设置。

## 5. 上线后自检

```sh
# sharp 的 Linux 原生依赖是否被正确打进镜像（P0-4）
docker compose exec blog node -e "console.log(require('sharp').versions)"
docker compose exec blog node -v                    # v24.22.1
docker compose exec caddy caddy version             # v2.11.7
docker compose exec blog node scripts/healthcheck.mjs

# 上传一张图片后，确认由 Caddy 直出：响应里有 ETag / Last-Modified，且没有 Server 头
curl -sI https://你的域名/uploads/刚上传的文件名.webp
```

图片响应头里没有 `ETag`，说明图片还在走 Node（Caddy 的 `file_server` 没命中），检查 `data/uploads` 的挂载与属主。`next.config.ts` 已包含 pnpm 原生包布局的追踪兜底；sharp 自检失败时仍需查看容器日志与打包出的原生库，不能只以本地构建成功作验收。

## 6. 更新

```sh
cd /opt/self_blog
git pull
docker compose up -d --build
```

内容都在 `data/`（挂载到容器外），重建镜像不会丢失。

文章内容（`data/posts/*.md`）已纳入版本控制。在服务器后台发文/改文后记得提交，否则下次 `git pull` 会冲突，误删也没有历史可回滚：

```sh
git add data/posts && git commit -m "content: 更新文章"
git push                    # 仅 commit 仍是单机副本；私有仓库也需审查草稿内容
```

如果 `git pull` 报 `data/posts` 冲突，说明本地和服务器改过同一篇，先合掉冲突再构建。

## 7. 备份与恢复

```sh
sh deploy/backup.sh
```

脚本把 `data/`（文章、评论、设置、账号哈希、图片，不含 `sessions.json` 登录态）打包到 `deploy/backups/`：先写 `.partial`，用 `tar -tzf` 校验可读后才改成正式文件名；有目录锁，cron 重叠会自动跳过；默认保留最近 14 份。

加进 crontab 每天 4 点跑（`crontab -e`）：

```sh
0 4 * * * cd /opt/self_blog && sh deploy/backup.sh
```

可选参数直接写在 cron 行里：

```sh
0 4 * * * cd /opt/self_blog && BACKUP_KEEP=30 BACKUP_REMOTE=r2:blog-backup sh deploy/backup.sh
```

`BACKUP_REMOTE` 需要先装 rclone 并 `rclone config`（对象存储或另一台机器都行）。配置了远端但缺 rclone 或上传失败，脚本会非零退出，保留本地新备份且不清理历史，供 cron/监控识别失败。`BACKUP_KEEP` 必须为正整数；异地失败恢复后应检查磁盘占用。`.env` 不在备份里（三个密钥），单独存到密码管理器，换机器时重新填。

上线第一周做一次**恢复演练**：

```sh
# 1) 在同一文件系统的独立目录解包；仅使用自己的可信备份
cd /opt/self_blog
restore_dir=$(mktemp -d ./deploy/restore-XXXXXX)
tar -xzf deploy/backups/data-YYYYmmdd-HHMMSS.tar.gz -C "$restore_dir"
test -d "$restore_dir/data/posts" && test -d "$restore_dir/data/uploads"
find "$restore_dir/data" -type f | sort
# 核对文件清单、正文和图片；需要一致时间点时，应短暂停写后创建备份。

# 2) 确认备份正确后才真正替换。逐条执行，任一步失败即停下。
docker compose down
rollback_dir=$(mktemp -d ./deploy/pre-restore-XXXXXX)
mv data "$rollback_dir/data"
mv "$restore_dir/data" data
chown -R 1001:1001 data
docker compose up -d
docker compose exec blog node scripts/healthcheck.mjs
# 验收文章、评论、图片和登录后，再决定旧目录的保留时间。
```

不要覆盖解包到正在使用的 `data/`：那会保留备份之后新增的文件和旧登录态。整目录替换保留回滚副本，并使恢复结果与备份一致；备份不含会话，恢复后需要重新登录。`deploy/restore-*`、`deploy/pre-restore-*` 含运行数据，应按备份管理，不提交到 Git。

## 8. 可用性监控

外部探活使用 `https://你的域名/healthz`，期望 200 且 JSON 为 `{"status":"healthy"}`，异常时通过你配置的通知渠道提醒。该路由不缓存，并验证数据目录实际可用；`/robots.txt` 仅生成 SEO 规则，不能验证数据卷。也可以再探一次首页 `/`。

## 9. 运维备注

- **单实例，不要扩副本**：文章/评论写入用 `lib/store.ts` 的进程内 `withLock`，只对单个 Node 进程有效；`docker compose up --scale blog=2` 会造成写竞争。将来要扩，先把存储换成 SQLite/Redis。
- **日志**：compose 已把 json-file 限制为 10MB × 3 份，不会无限增长；查看用 `docker compose logs --tail=200 blog`。
- **只读根文件系统**：`blog` 容器根文件系统只读，只有 `/app/data`（可写挂载）和 `/tmp`（tmpfs）可写；新增写文件的逻辑要落到这两处，否则会报 `EROFS`。
- **图片直出**：`/uploads/*` 由 Caddy 从只读挂载的 `data/uploads` 直接返回，文件不存在时才回落到 Node 路由；宿主机 `data/uploads` 的属主必须是 1001。
- **改 `.env` 后**：执行 `docker compose up -d`（会重建容器并重读配置）；`docker compose restart` 不会重读 `.env`。

## 常见问题

- 构建卡在 corepack / pnpm install：国内网络没换源，见第 4 节的 `NPM_REGISTRY`。
- 构建被 OOM killer 杀掉（`dmesg | grep -i oom` 有记录）：先加 swap 或换 2C2G，见第 2 节。
- `blog` 一直 unhealthy：`docker compose logs blog`，再跑第 5 节的 sharp 自检；HEALTHCHECK 不过时 Caddy 不会启动，表现是站点打不开而不是 502。
- 证书签不下来：确认解析已生效（`ping 域名` 指向本机），且 80 端口没被其他程序占用。
- 上传图片报权限错误：`data/uploads` 的属主不是 1001（被 Docker 以 root 建过目录），重新执行第 3 节的 `chown`。
- 备份一直跳过：`deploy/backups/.lock` 目录残留（进程被 kill -9 过），`rm -rf deploy/backups/.lock` 后重试。
- 怀疑密码泄露：在「我的账号」修改自己的密码，或由管理员在「账号管理」重置目标账号。该账号所有旧会话会立即失效；改 `.env` 的 `BLOG_ADMIN_PASSWORD` 不会重置已经初始化的账号。更换 `BLOG_SESSION_SECRET` 则使所有账号的设备下线。
- 账号数据与恢复：不要删除或公开 `data/accounts.json`，它包含用户名、角色和密码哈希。备份会包含该文件；恢复时需保留它，旧会话不应恢复。如果回退到不支持多人账号的旧镜像，必须同时撤销全部登录会话，避免旧版本忽略角色权限。
- 应用端口 3000 只对 Caddy 可见，不要在 compose 里把它映射到宿主机，否则访客 IP 可被伪造，登录限流会失效。
