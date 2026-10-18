# 部署到 VPS

需要：一台装了 Docker（含 compose 插件）的 Linux VPS，一个域名。

## 1. 域名解析

把域名（如 `blog.example.com`）的 A 记录指向 VPS 公网 IP。`www.` 子域名可选，配了会自动跳转到主域名。
防火墙放行 80、443（TCP）和 443（UDP，HTTP/3）。

## 2. 上传代码并配置

```sh
git clone <你的仓库> /opt/self_blog && cd /opt/self_blog
cp .env.example .env
openssl rand -base64 48     # 生成的内容填到 BLOG_SESSION_SECRET
nano .env                   # 填 BLOG_ADMIN_PASSWORD、SITE_URL、DOMAIN

mkdir -p data/posts data/uploads
chown -R 1001:1001 data     # 容器内以 uid 1001 运行，需要能写 data/
```

本地已有的文章，把 `data/` 整个拷到服务器同一位置即可。

## 3. 启动

```sh
docker compose up -d --build
docker compose logs -f caddy   # 看到证书签发成功即可访问
```

打开 `https://你的域名/login` 登录后台。

## 更新

```sh
git pull && docker compose up -d --build
```

内容都在 `data/`（挂载到容器外），重建镜像不会丢失。

## 备份

```sh
sh deploy/backup.sh
```

会打包到 `deploy/backups/`，保留最近 14 份。建议加进 crontab 每天跑一次，并定期把备份拷离这台机器。

## 常见问题

- 证书签不下来：确认解析已生效（`ping 域名` 指向本机），且 80 端口没被其他程序占用。
- 上传图片报权限错误：`data/` 的属主不是 1001，重新执行上面的 `chown`。
- 怀疑密码泄露：改 `.env` 里的 `BLOG_ADMIN_PASSWORD`，再执行 `docker compose up -d`。要让所有已登录设备立刻下线，就同时更换 `BLOG_SESSION_SECRET`，或者在后台「设备」页退出其他设备。
- 应用端口 3000 只对 Caddy 可见，不要在 compose 里把它映射到宿主机，否则访客 IP 可被伪造，登录限流会失效。
