# 个人博客项目（self_blog）

## 目标
作者的个人博客：多端登录后台直接发布文章/图片、访客可评论、前卫精致的中文界面。
不要做成 WP/Halo 式的重后台，也不要纯静态站。

## 技术栈（已定）
- Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS v4（无 UI 组件库）
- 内容：`data/posts/*.md`（gray-matter frontmatter），不入数据库
- 数据：`data/comments.json`、`data/settings.json`、`data/projects.json`；原子写文件
- 认证：单管理员，密码在 `.env.local`（`BLOG_ADMIN_PASSWORD`），HMAC 签名 Cookie
- 图片：上传到 `data/uploads/`，经 `/uploads/[...path]` 路由输出（不用 public，prod 也能读到）
- Markdown 渲染：react-markdown + remark-gfm + rehype-highlight/slug
- 搜索：服务端扫描文章生成结果页（不引入搜索服务）

## 命令
```powershell
pnpm dev        # http://localhost:3000
pnpm build
pnpm typecheck
```

## 目录约定
- `app/(site)/` 前台，`app/admin/` 后台，`app/login/` 登录
- `components/site/`、`components/ui/`、`components/admin/`
- `lib/` 数据与工具（`cn.ts`/`format.ts` 可进客户端，其余 Node-only）
- `data/` 内容与数据，`data/uploads/` 忽略提交
- `.agents/skills/` 项目级技能（frontend-design、web-design-guidelines、webapp-testing）
- `docs/design-references/` 设计参考、设计板、参考素材与交接文档（`HANDOFF.md`）

## 设计取向
- 工业设计平面（graphic industrial）：产品目录 / 技术图纸 / 铭牌标签 / 设备手册的版式语言
- 纸白（#EFEBE3）+ 墨黑（#17171A）+ 薄荷（#D3E4D6）+ 安全橙（#E8531F）主强调 + 信号粉（#FF2D6F）标记；深色为机柜黑（#111113）
- 字体：Archivo / 思源黑体 Heavy 做标题，Inter / 思源黑体正文，IBM Plex Mono 标签与编号；不再使用衬线（移除 Fraunces）
- 12 列栅格、1px 结构线、编号系统（NO./FIG./CAT./REV.）、mono 图注；每屏 ≤3 类标记，标记须承载信息
- 关键交互控件按 80/20 做写实（塑料 / LCD / 丝印），只出现在交互点；正文阅读区保持平面
- 完整规范：`docs/design-references/design-reference.md`；交接与待办：`docs/design-references/HANDOFF.md`
- 旧"暖纸 + 陶土橙"方向已废弃，仅归档于 `docs/design-references/README.md`
- 响应式优先，移动端后台也要能发文；支持 `prefers-reduced-motion`
- 设计拿不准时先加载 `frontend-design` skill；UI 改动后用 `webapp-testing` 验证

## 约定
- 用户重视视觉细节，界面相关需求按"精致"标准做，不敷衍占位样式
- 不新增数据库/ORM/重型依赖；新依赖需说明理由
- 代码注释少而准；界面文案中文
- 后端逻辑不得在客户端组件中引用 node 内置模块
- 每次改完 UI 跑 `pnpm typecheck`（有构建脚本后加 `pnpm build`）

## 待定
- 公网部署方式（本地可运行优先，之后 Docker/一键脚本）
- 是否启用 Agentation MCP 批注闭环（已装全局 CLI，profile 已配置）
