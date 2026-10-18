# 纸上

个人博客，Next.js 16 + React 19 + TypeScript + Tailwind v4 搭建。内容存本地 Markdown 文件，不依赖数据库。

## 开发

```sh
pnpm install
cp .env.example .env.local
# 填写 BLOG_ADMIN_PASSWORD、BLOG_SESSION_SECRET（可用 openssl rand -base64 48 生成）

pnpm dev         # http://localhost:3000
pnpm build       # 生产构建
pnpm typecheck   # 类型检查
```

第一次访问前台会看到空目录，在 `/login` 登录后进入后台发布文章。

## 部署

见 [DEPLOY.md](./DEPLOY.md)。简述：Docker + Caddy 一键启动，域名解析后自动申请 HTTPS 证书。

## 技术栈

- **框架**：Next.js 16 App Router + React 19 + TypeScript
- **样式**：Tailwind CSS v4（无 UI 组件库）
- **内容**：Markdown 文件 + gray-matter frontmatter，存在 `data/posts/`
- **数据**：评论、设置、会话存 JSON，原子写入
- **认证**：HMAC 签名 Cookie，支持多设备登录
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
├── settings.ts      # 站点设置、项目列表
├── auth.ts          # 会话管理（创建、验证、列出设备、移除会话）
├── crypto.ts        # HMAC 签名、令牌生成、密码校验
├── format.ts        # slug 生成、Markdown 去格式、阅读时长
├── request.ts       # 客户端 IP、UA 解析、IP 掩码、同源检查
├── store.ts         # JSON 原子写入（覆盖式，文件级锁）
├── env.ts           # 环境变量和目录常量
└── types.ts         # 类型定义

data/                # 内容和数据（.gitignore 已排除敏感文件）
├── posts/*.md       # Markdown 文章
├── uploads/         # 上传的图片（按年月分目录）
├── comments.json    # 评论列表
├── sessions.json    # 登录会话
├── settings.json    # 站点配置
└── projects.json    # 项目展示

deploy/
├── Caddyfile        # 反向代理 + 自动 HTTPS
└── backup.sh        # 备份脚本（打包 data/ 并保留最近 14 份）
```

## 设计取向

暖纸色（#f4f0e8）+ 墨黑底深色模式，双主题切换。陶土橙（#bf4f28）点缀链接和主操作。Inter 为主，Fraunces 衬线用于年份数字和英文点缀。细分割线、大留白、克制的纸张颗粒，拒绝模板感。

## 许可

MIT
