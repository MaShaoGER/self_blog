# 无域名的 VPS 预览

使用 `docker-compose.preview.yml`，让博客只监听 VPS 的 `127.0.0.1:9443`，再通过 SSH 隧道访问。现有网站可以继续占用 80/443。

## 服务器准备

需要 Linux、Docker Compose 与已配置好的 SSH 密钥登录。将项目放在自己的目录（以下以 `/opt/self_blog` 为例），按 `DEPLOY.md` 准备 `.env`、`data/posts` 与 `data/uploads`，数据目录属主为 `1001:1001`。

`.env` 的站点地址使用：

```dotenv
SITE_URL=https://localhost:9443
```

同时填写自己的 `BLOG_ADMIN_PASSWORD` 和 `BLOG_SESSION_SECRET`，不要将真实值提交到仓库。首次登录的用户名为 `admin`；账号初始化后，在后台修改密码。

## 启动预览

```sh
cd /opt/self_blog
docker compose -p self-blog-preview -f docker-compose.preview.yml config --quiet
docker compose -p self-blog-preview -f docker-compose.preview.yml up -d --build --wait
docker compose -p self-blog-preview -f docker-compose.preview.yml ps
```

预览使用独立网络、日志上限和只读应用根文件系统。Caddy 在应用健康检查通过后启动；Node 的 3000 端口不暴露到宿主机。

## 建立 SSH 隧道

在自己的电脑运行，用实际连接信息替换参数：

```powershell
pwsh -File .\deploy\open-vps-preview.ps1 `
  -SshHostName YOUR_VPS_HOST `
  -SshUserName YOUR_SSH_USER `
  -IdentityFile "$env:USERPROFILE\.ssh\YOUR_PRIVATE_KEY"
```

保持终端打开，然后访问：

- 首页：<https://localhost:9443/>
- 登录：<https://localhost:9443/login>
- 健康检查：<https://localhost:9443/healthz>

该地址只在建立隧道的电脑上可用。Caddy 使用内部 CA 签发的预览证书，浏览器首次会提示证书未受信任，需要在 localhost 提示中继续访问；脚本不会安装系统根证书。生产 Secure / HttpOnly Cookie 和 CSP 保持启用。

首次 SSH 连接应先核对服务器主机指纹并完成登录，再使用此脚本；脚本启用了严格主机密钥检查。

## 验收与运维

```sh
cd /opt/self_blog
docker compose -p self-blog-preview -f docker-compose.preview.yml exec -T blog node scripts/healthcheck.mjs
docker compose -p self-blog-preview -f docker-compose.preview.yml exec -T blog node -v
docker compose -p self-blog-preview -f docker-compose.preview.yml exec -T blog node -e "console.log(require('sharp').versions)"
docker compose -p self-blog-preview -f docker-compose.preview.yml logs --tail=100 blog
sh deploy/backup.sh
```

还应通过浏览器检查登录、图片上传、首页设置保存、手机布局，以及重启应用后的数据保留。备份应在独立临时目录解包，比对文件清单与 SHA-256；不要覆盖解包到在线目录。

暂停预览并保留内容：

```sh
docker compose -p self-blog-preview -f docker-compose.preview.yml stop
```

账号文件随 `data/` 备份，会话继续排除。更新代码时保留服务器上的 `.env` 和 `data/`。回退到旧单管理员镜像前必须撤销全部会话。

有域名后，按 `DEPLOY.md` 规划正式入口；若 80/443 已被其他反向代理占用，先完成衔接配置，不要直接抢占端口。实际主机地址、凭据、私有备份与个人部署记录应留在仓库外。
