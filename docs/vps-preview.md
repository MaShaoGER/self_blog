# 无域名的 HTTPS 预览

保留 HTTPS 和 SSH 隧道，浏览器访问 <https://localhost:9443/>。根据服务器已有网关选择入口，实际主机地址、证书密钥与凭据保存在仓库外。

## 已有 Openresty / Nginx

优先使用 `docker-compose.gateway.yml`，博客只有一个应用容器，绑定 `127.0.0.1:33030`。

1. 按 `DEPLOY.md` 将内容与配置放在 `/srv/self_blog` 和 `/etc/self_blog`。
2. 在已有网关添加独立 localhost HTTPS 站点，参考 `deploy/openresty.conf.example`。证书路径需按网关的实际挂载填写。
3. 先在空闲本机端口验证证书、代理和 `/healthz`，再切换到 `127.0.0.1:9443`。
4. 私有 `deploy.env` 使用 `BLOG_DEPLOY_MODE=gateway`，运行 `self-blog-update`。

对仅本机 SSH 预览，可使用 SAN 包含 localhost 的自签证书。证书和私钥留在网关私有目录，私钥权限 `0600`，不挂给应用。浏览器首次会提示证书未受信任；脚本不安装系统根证书。

入口须保留完整 Host / X-Forwarded-Host，覆盖来源 IP 并传递 HTTPS 协议。不要把应用端口公开暴露。

## 没有已有网关

可选 `docker-compose.preview.yml`，增加一个 Caddy 提供 localhost HTTPS。私有配置使用 `BLOG_DEPLOY_MODE=preview`。应用配置仍统一引用 `compose.app.yml`，内容目录和更新命令相同。

Caddy 使用内部 CA 签发预览证书，监听 VPS 的 `127.0.0.1:9443`。不占用公网 80/443，也不需要域名。

## 建立 SSH 隧道

在自己的电脑运行，用实际信息替换参数并保持终端打开：

```powershell
pwsh -File .\deploy\open-vps-preview.ps1 `
  -SshHostName YOUR_VPS_HOST `
  -SshUserName YOUR_SSH_USER `
  -IdentityFile "$env:USERPROFILE\.ssh\YOUR_PRIVATE_KEY"
```

首次 SSH 连接应核对主机指纹并完成登录，脚本启用了严格主机密钥检查。

- 首页：<https://localhost:9443/>
- 登录：<https://localhost:9443/login>
- 健康检查：<https://localhost:9443/healthz>

链接只在建立隧道的电脑上生效。应用仍使用生产 Secure / HttpOnly Cookie 和 CSP，`SITE_URL=https://localhost:9443`。

## 后续更新

日常在后台保存文章、图片、项目、导航和页脚。程序更新时手动运行 `self-blog-update`；回退用 `self-blog-update --rollback`。运行数据与账号保存在源码外，更新命令只快进拉取干净的代码工作区，先备份再构建和检查。

详细目录、备份恢复、旧数据迁移、入口模式与初始化步骤见 [DEPLOY.md](../DEPLOY.md)。
