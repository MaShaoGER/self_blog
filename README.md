# 纸上

个人博客，Next.js 16 + React 19 + TypeScript + Tailwind v4 搭建。内容存本地 Markdown 文件，不依赖数据库。

## 开发

```sh
pnpm install
cp .env.example .env.local
# 填写 BLOG_ADMIN_PASSWORD、BLOG_SESSION_SECRET（可用 openssl rand -base64 48 生成）
pnpm data:init   # 创建源码外的运行目录；想使用演示内容可加 --demo

pnpm dev         # http://localhost:3000
pnpm build       # 生产构建
pnpm typecheck   # 类型检查
```

演示文章与项目位于 `examples/data/`。真实内容默认写入源码旁的 `../self_blog-data`，可通过 `BLOG_DATA_DIR` 指定。已有旧 `data/` 时运行 `pnpm data:migrate --from ./data`，复制校验后保留原目录。打开 `/login`，首次使用用户名 `admin` 与 `BLOG_ADMIN_PASSWORD` 登录。

## 后台功能

- **账号管理**：管理员创建、停用、重置协作者账号，区分管理员与编辑。
- **我的账号**：修改密码、查看登录设备、退出自己的其他设备。
- **文章与图库**：Markdown 编辑、草稿与定时发布、图片上传与 WebP 转换。
- **项目展示**：后台新增、编辑、删除项目，修改链接、标签和状态。
- **站点设置**：编辑站名、作者、介绍、首页文案、全站导航与页脚；统计数字自动生成。

完整权限和迁移说明见 [多人账号与首页文案](./docs/accounts-and-homepage.md)。

发布前运行 `pnpm check:release`，包含类型检查、构建、功能测试、独立生产包检查与依赖审计。

## 部署

见 [DEPLOY.md](./DEPLOY.md)。已有 Openresty/Nginx 时只运行一个博客应用容器；也可选择独立 Caddy HTTPS 或 [SSH 隧道预览](./docs/vps-preview.md)。应用配置集中在 `compose.app.yml`。

配置一次后，代码更新手动运行 `self-blog-update`，回退运行 `self-blog-update --rollback`。脚本负责备份、拉取、构建和健康检查；没有后台自动部署或 GitHub Actions。后台保存文章、项目和文案直接生效。

## 技术栈

- **框架**：Next.js 16 App Router + React 19 + TypeScript
- **样式**：Tailwind CSS v4（无 UI 组件库）
- **内容**：Markdown 文件 + gray-matter frontmatter，存在 `BLOG_DATA_DIR/posts/`
- **数据**：评论、设置、账号和会话存 JSON，原子写入
- **认证**：scrypt 密码哈希与 HMAC 签名 Cookie，支持角色权限和多设备登录
- **图片**：上传到 `data/uploads/`，自动转 WebP 压缩并去除 EXIF
- **Markdown 渲染**：react-markdown + remark-gfm + rehype-highlight/slug

## 目录结构

```
app/
├── (site)/          # 前台：首页、文章页、归档、标签、搜索、关于
├── admin/           # 后台管理
│   ├── (shell)/     # 带侧栏和底部导航的外壳
│   └── posts/       # 编辑器（左编辑右预览，移动端切换标签）
├── login/           # 登录页
├── api/upload/      # 图片上传
├── feed.xml/        # RSS
├── uploads/[...path]/ # 静态图片输出
└── globals.css      # 全局样式 + 设计 token

components/
├── site/            # 前台组件（header、footer、目录、评论表单）
├── admin/           # 后台组件（导航、筛选标签、确认对话框、状态标签）
└── ui/              # 通用 UI（Markdown 渲染）

lib/
├── posts.ts         # 文章读写、解析、校验
├── comments.ts      # 评论管理（状态、审核、按 IP 限流）
├── settings.ts      # 站点、首页、导航与页脚设置
├── projects.ts      # 项目展示的读写与校验
├── auth.ts          # 会话管理（创建、验证、列出设备、移除会话）
├── accounts.ts      # 账号、角色、密码哈希与版本撤销
├── crypto.ts        # HMAC 签名、令牌生成、密码校验
├── format.ts        # slug 生成、Markdown 去格式、阅读时长
├── request.ts       # 客户端 IP、UA 解析、IP 掩码、同源检查
├── store.ts         # JSON 原子写入（覆盖式，文件级锁）
├── env.ts           # 环境变量和目录常量
└── types.ts         # 类型定义

shared/              # 前后台共用的纯配置与校验
├── homepage-settings.ts
└── site-chrome.ts

examples/data/       # 仓库里的演示内容

../self_blog-data/   # 默认运行数据目录，位于源码外
├── posts/*.md       # Markdown 文章
├── uploads/         # 上传的图片（按年月分目录）
├── comments.json    # 评论列表
├── sessions.json    # 登录会话
├── accounts.json    # 账号与密码哈希（不提交）
├── settings.json    # 站点配置
└── projects.json    # 项目展示

deploy/
├── Caddyfile        # 反向代理 + 自动 HTTPS
├── backup.sh        # 备份运行数据并保留最近 14 份
├── update.sh        # 手动更新与回退
└── self-blog-update # 安装到服务器的一次性入口

compose.app.yml     # 统一应用配置，三个入口文件复用
```

## 设计取向

工业平面：纸白（#EFEBE3）、墨黑（#17171A）、薄荷（#D3E4D6）与安全橙（#E8531F），支持深浅主题。Archivo 标题、Inter 正文和 IBM Plex Mono 编号，使用结构线、参数表和少量写实交互控件。完整规范见 [设计参考](./docs/design-references/design-reference.md)。

## 许可

MIT
