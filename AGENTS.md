# 个人博客项目（self_blog）

## 目标
作者的个人博客：多端登录后台直接发布文章/图片、访客可评论、前卫精致的中文界面。
不要做成 WP/Halo 式的重后台，也不要纯静态站。

## 技术栈（已定）
- Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS v4（无 UI 组件库）
- 内容：`BLOG_DATA_DIR/posts/*.md`（gray-matter frontmatter），不入数据库；默认运行目录为源码旁的 `../self_blog-data`
- 数据：运行目录内 comments/settings/projects/accounts JSON；原子写文件。仓库只保留 `examples/data` 演示内容
- 认证：多人后台（管理员 / 编辑），scrypt 密码哈希与 HMAC 签名 Cookie；`BLOG_ADMIN_PASSWORD` 仅用于首次初始化 `admin` 账号
- 权限：管理员管理账号和站点设置，编辑管理文章 / 图库 / 评论；设备和密码只允许管理自己的账号
- 首页文案：`SiteSettings.homepage`，后台「设置」分组编辑；统计读数由文章自动生成
- 全站文案：`SiteSettings.navigation` / `footer`，后台「设置」编辑；项目展示由 `/admin/projects` 管理，仅管理员可改
- 图片：上传到 `data/uploads/`，经 `/uploads/[...path]` 路由输出（不用 public，prod 也能读到）
- Markdown 渲染：react-markdown + remark-gfm + rehype-highlight/slug
- 搜索：服务端扫描文章生成结果页（不引入搜索服务）

## 命令
```powershell
pnpm dev        # http://localhost:3000
pnpm build
pnpm typecheck
pnpm data:init  # 创建源码外的空运行目录；--demo 只用于空目录演示数据
```

## 目录约定
- `app/(site)/` 前台，`app/admin/` 后台，`app/login/` 登录
- `components/site/`、`components/ui/`、`components/admin/`
- `lib/` 数据与工具（`cn.ts`/`format.ts` 可进客户端，其余 Node-only）
- `shared/` 前后台共用的纯配置、类型与校验，不引用 Node 模块
- `examples/data/` 演示内容；真实运行数据在源码外，遗留 `data/` 全部忽略提交
- `compose.app.yml` 统一应用配置；HTTPS / preview / gateway 三个入口文件复用它
- 手动部署用 `self-blog-update`；私有配置、数据、状态、备份分别在 `/etc/self_blog` 和 `/srv/self_blog`，不入 Git
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
