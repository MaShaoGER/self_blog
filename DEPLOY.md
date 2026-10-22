# 手动部署与更新

内容、配置与程序各自保存。日常在后台写文章、换图、维护项目、改文案，保存后生效；程序修改后推送 Git，再在 VPS 手动执行一次更新命令。

## 目录

| 位置 | 用途 |
|---|---|
| `/opt/self_blog` | Git 源码，可拉取更新 |
| `/srv/self_blog/data` | 文章、图片、设置、账号与会话 |
| `/etc/self_blog/blog.env` | 应用密码、签名密钥与站点地址 |
| `/etc/self_blog/deploy.env` | 部署模式、目录、Compose 项目名 |
| `/srv/self_blog/state` | 当前 / 上一镜像与更新锁 |
| `/srv/self_blog/state/backups` | 更新前的内容备份 |

真实运行数据和环境文件放在仓库外。仓库的 `examples/data` 仅用于可选演示。

## 首次准备

需要 Linux、Git、Docker Compose 和足够的构建空间。所有写入由单个应用实例负责，不扩多副本。

```sh
git clone https://github.com/MaShaoGER/self_blog.git /opt/self_blog
cd /opt/self_blog
install -d -m 700 /etc/self_blog /srv/self_blog/state
install -d -o 1001 -g 1001 /srv/self_blog/data /srv/self_blog/data/posts /srv/self_blog/data/uploads
cp .env.example /etc/self_blog/blog.env
cp deploy/.env.example /etc/self_blog/deploy.env
chmod 600 /etc/self_blog/*.env
```

填写 `blog.env` 中的 `BLOG_ADMIN_PASSWORD`、`BLOG_SESSION_SECRET`、`SITE_URL`。首次账号用户名为 `admin`；初始化后在后台改密码，环境变量只用于首次初始化。容器内始终使用 `/app/data`。

`deploy.env` 默认使用上表路径；按实际部署调整。内容目录需要 UID/GID `1001:1001` 可写，账号文件保持 `0600`。普通目录可用 `0755`，内容文件 `0644`。

## 选择入口

三种模式只选一种，共用根目录 `compose.app.yml` 的应用配置：

| `BLOG_DEPLOY_MODE` | 文件 | 入口 |
|---|---|---|
| `gateway` | `docker-compose.gateway.yml` | 一个 blog 容器，`127.0.0.1:33030`，接现有 Openresty/Nginx |
| `preview` | `docker-compose.preview.yml` | blog + Caddy，本机 `9443`，通过 SSH 预览 |
| `https` | `docker-compose.yml` | blog + Caddy，占用 80/443，域名自动 HTTPS |

已有网关优先选 `gateway`，在网关将独立站点转发到 `http://127.0.0.1:33030`。参考 `deploy/openresty.conf.example`，保留完整 Host / X-Forwarded-Host，覆盖 X-Forwarded-For / X-Real-IP，传递 HTTPS 协议。应用端口只绑定本机，不能公开暴露。

示例 TLS 证书路径需要按网关实际挂载填写。没有域名的预览可以使用 localhost 自签证书与 SSH 隧道；首次浏览器会提示证书未受信任。已有 80/443 服务时不要启动独立 `https` 模式抢占端口。

`preview` 详见 [预览说明](./docs/vps-preview.md)。`https` 还需填写 DOMAIN，配置域名解析并放行 80/443。

## 手动更新

先在开发电脑测试并提交推送代码，再在 VPS 运行：

```sh
cd /opt/self_blog
install -m 755 deploy/self-blog-update /usr/local/bin/self-blog-update
self-blog-update
```

包装命令只安装一次。其等价命令是：

```sh
BLOG_DEPLOY_CONFIG=/etc/self_blog/deploy.env sh /opt/self_blog/deploy/update.sh
```

每次执行会检查工作区、目录和锁，备份内容，`fetch` 后仅允许 fast-forward 更新，构建独立镜像，再等待应用健康检查。构建前失败保留原服务；启动或健康检查失败时尝试恢复已记录的上一镜像。更新不会覆盖私有环境文件或内容目录。没有自动触发器。

镜像标记包含源码提交、时间和进程号，同一提交重复构建也会保留原镜像。初次接管已有服务时，先将实际正在运行且兼容的镜像写入 `state/current-image`，保留该镜像，再执行更新；不要凭空填写不存在的镜像。

初次源码包接管可用 `self-blog-update --no-pull`，仍会检查干净的 Git 工作区、备份、构建与健康状态。日常更新不需要该选项。

## 回退与内容备份

```sh
self-blog-update --rollback
```

回退使用已记录镜像，不拉代码、不重新构建，仍先备份并检查健康。保留最新内容与账号数据；数据格式有变化的版本应先确认兼容性。回退到旧单管理员程序前必须撤销全部会话。

备份包含账号密码哈希，排除会话和临时文件，默认保留 14 份。配置了异地目标但上传失败会返回失败并保留本地历史；更新遇到备份锁也会停止。

手动另做一份备份：

```sh
cd /opt/self_blog
BLOG_HOST_DATA_DIR=/srv/self_blog/data BACKUP_DIR=/srv/self_blog/state/backups sh deploy/backup.sh
```

恢复时先解包到独立目录并核对文件与 SHA-256，再停应用、保留现有目录、整份替换并校正权限。不要覆盖解包到在线数据目录。`.env` 单独妥善保管，不进内容备份。

## 旧目录迁移

本地有 Node 24 时：

```sh
pnpm data:migrate --from ./data --to ../self_blog-data
```

脚本复制并逐文件 SHA-256 校验，拒绝覆盖不同的现有数据、嵌套路径和源码内目标，保留原目录。迁移线上数据前停止写入进程，保留原权限与属主；先验证新挂载和登录，再归档旧目录。服务器没有宿主 Node 时，可用已有 Node 镜像或其他经过校验的复制工具完成同一流程。

旧目录是代码与内容混合布局时，迁移完成后使用干净的 Git checkout，私有文件保存在源码外。工作区出现未提交修改会阻止更新，脚本不执行强制重置。

## 自检

```sh
cd /opt/self_blog
set -a; . /etc/self_blog/deploy.env; set +a
docker compose -p "$BLOG_COMPOSE_PROJECT_NAME" --env-file "$BLOG_ENV_FILE" -f docker-compose.gateway.yml ps
docker compose -p "$BLOG_COMPOSE_PROJECT_NAME" --env-file "$BLOG_ENV_FILE" -f docker-compose.gateway.yml exec -T blog node scripts/healthcheck.mjs
```

按所选模式替换 compose 文件。浏览器还应检查登录、图片上传、文章和项目修改、导航及页脚保存，以及重启后的内容保留。

保留回退镜像需要磁盘空间；按项目归属检查旧镜像和构建缓存，避免清理其他服务。日志已封顶，更新过程不打印运行密码。
