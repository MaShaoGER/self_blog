# 部署到 VPS

需要：一台装了 Docker（含 compose 插件）的 Linux VPS，一个域名。

> 只部署**单实例**：应用用进程内锁保证写入串行，不要扩多副本，详见第 9 节。

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

Caddy 会等 `blog` 的 HEALTHCHECK 通过后再启动，避免启动瞬间 502。healthcheck 里包含 sharp 加载和 `/robots.txt` 请求，所以“blog 一直 unhealthy”通常说明镜像有问题（见下一节）。

打开 `https://你的域名/login` 登录后台。

## 5. 上线后自检

```sh
# sharp 的 Linux 原生依赖是否被正确打进镜像（P0-4）
docker compose exec blog node -e "console.log(require('sharp').versions)"

# 上传一张图片后，确认由 Caddy 直出：响应里有 ETag / Last-Modified，且没有 Server 头
curl -sI https://你的域名/uploads/刚上传的文件名.webp
```

第二项如果响应头里没有 `ETag`，说明图片还在走 Node（Caddy 的 `file_server` 没命中），检查 `data/uploads` 的挂载与属主。sharp 自检失败则按 `docs/deploy-review.md` P0-4 在 `next.config.ts` 加 `outputFileTracingIncludes`。

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
```

如果 `git pull` 报 `data/posts` 冲突，说明本地和服务器改过同一篇，先合掉冲突再构建。

## 7. 备份与恢复

```sh
sh deploy/backup.sh
```

脚本把 `data/`（文章、评论、设置、图片，不含 `sessions.json` 登录态）打包到 `deploy/backups/`：先写 `.partial`，用 `tar -tzf` 校验可读后才改成正式文件名；有目录锁，cron 重叠会自动跳过；默认保留最近 14 份。

加进 crontab 每天 4 点跑（`crontab -e`）：

```sh
0 4 * * * cd /opt/self_blog && sh deploy/backup.sh
```

可选参数直接写在 cron 行里：

```sh
0 4 * * * cd /opt/self_blog && BACKUP_KEEP=30 BACKUP_REMOTE=r2:blog-backup sh deploy/backup.sh
```

`BACKUP_REMOTE` 需要先装 rclone 并 `rclone config`（对象存储或另一台机器都行）；设置了但没装 rclone 时会跳过并提示。`.env` 不在备份里（三个密钥），单独存到密码管理器，换机器时重新填。

上线第一周做一次**恢复演练**：

```sh
# 1) 解包到临时目录，核对文章数
mkdir -p /tmp/restore
tar -xzf deploy/backups/data-YYYYmmdd-HHMMSS.tar.gz -C /tmp/restore
ls /tmp/restore/data/posts/*.md | wc -l

# 2) 真正恢复：先停容器，避免运行时写入覆盖解包内容
cd /opt/self_blog && docker compose down
tar -xzf deploy/backups/data-YYYYmmdd-HHMMSS.tar.gz -C .
chown -R 1001:1001 data
docker compose up -d
```

## 8. 可用性监控

用 UptimeRobot / healthchecks.io 探 `https://你的域名/robots.txt`：这是现成的动态路由，能同时验证 Node 进程和数据目录可读，异常时发邮件。也可以再探一次首页 `/`。

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
- 怀疑密码泄露：改 `.env` 里的 `BLOG_ADMIN_PASSWORD`，再执行 `docker compose up -d`。要让所有已登录设备立刻下线，就同时更换 `BLOG_SESSION_SECRET`，或者在后台「设备」页退出其他设备。
- 应用端口 3000 只对 Caddy 可见，不要在 compose 里把它映射到宿主机，否则访客 IP 可被伪造，登录限流会失效。
