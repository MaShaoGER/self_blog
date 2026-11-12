# 视频、工程资源与基础 3D 实施计划

> 历史实施记录：本计划的实验页面随后按用户决定撤下，当前正式功能与编辑器整合见 [后续计划](./2026-11-11-production-video-editor.md)。下述 `/preview`、`/lab` 是当时的验收路径，不是当前入口。


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Follow assigned file ownership; independent slices run in parallel as explicitly requested by the user.

**Goal:** 可管理的外部视频/模型/文件资源目录，真实播放与浏览，以及隔离的轻量 3D 界面实验。

**Architecture:** `resources.json` 仅保存外部资源索引，使用现有 JSON 原子写锁。公开元数据与实际访问地址分离；私有条目沿用现有后台账号会话，不创建访客认证。视频与 Three.js 是按需加载的客户端小岛。Cloudreve 未提供实例/凭据，不伪造对接；可录入其已生成的 HTTPS 直链。

**Tech Stack:** Next.js16 / React19 / TypeScript / CSS Modules；新增固定版 three、@types/three、hls.js，仅提供实际3D和HLS能力，不加组件库。

**Spec:** 本文件记录用户已授权的实施范围：视频播放、文件浏览、基础3D支持、少量3D界面测试；用户不在场，由主代理自行集成验证。

## Global Constraints

- 不更换正式首页、不更改认证、不增数据库、不保存大型二进制到博客运行目录。
- 不实现 AE 深度解析，不假装 Cloudreve 实例已连接，不承诺任意视频网站直链解析。
- 原有 AGENTS.md 修改与 preview 文件是已有工作，不覆盖用户改动、不提交、不推送。
- 仅服务端持久化资源 URL；公开列表不返回 source。访问源站的 URL 必须在资源授权后取得。
- private 目录保护所有后代，API 不接受文件系统路径，拒绝循环目录、越界父目录和未知格式。
- 资源是 HTTPS 直链或明确的 YouTube/Bilibili ID；无后端任意 URL 代理、无网页抓取。
- 页面中文、手机和键盘可用、双主题、减弱动效；3D 不代替正常链接和文件列表。
- 子代理跳过构建/测试/格式化，由主代理最后统一验证；必要行为回归测试先编写，最后集中执行。

## Review Focus

- 私有目录中的 public 子项不得被匿名列表、单项、access、download 接口泄露。
- 过期直链必须明确提示，不作为永久身份；不承诺自动续签。
- 项目目录移动不能形成环，损坏目录文件不得被覆盖。
- HLS 播放器销毁和 Three GPU/事件清理完整，失败时有真实错误和下载/重试入口。
- 模型仅支持 GLB，影片编码由浏览器决定；外部子资源仍受 CSP 限制。

## Rulings

- Working tree: 原地实施且不提交，保留当前可见预览与已有未提交内容；用户明确要求无人值守自行推进，不额外创建需要迁移现场配置的工作树。
- 分工：资源后端、视频播放器、3D组件、前后台资源UI互不改对方文件；共享类型 `shared/resource-types.ts` 由主代理先定义。
- 私有条目意味着现有后台账号可访问，并非新的匿名密码分享系统。
- 当前资源索引独立于原有展示项目列表：任何根目录可作为一个工程包，不绑定旧 Project 类型，避免破坏已有项目。

## Task 1 — 资源服务与 API（DS）

- [x] `shared/resource-validation.ts` 校验受限外链、ID、格式、字段。
- [x] `lib/resources.ts` 实现 CRUD、匿名过滤、祖先权限、目录分页与来源集合。
- [x] `/api/resources`、`/[id]`、`/[id]/access`、`/[id]/download` 接口。
- [x] `tests/resources.test.mjs` 覆盖祖先权限、目录环、非法URL、过期访问、损坏文件和并发持久化。

## Task 2 — 视频播放器（DS）

- [x] `components/resources/video-player.tsx` 及 CSS Module：MP4/WebM、原生 HLS / HLS.js、官方 YouTube/Bilibili iframe，按点击加载第三方。
- [x] 加载/失败/重试、原生控件、无自动播放、销毁清理。

## Task 3 — 模型与 3D 实验（DS）

- [x] `components/resources/model-viewer.tsx` 及 CSS Module：延迟启动、Three GLTFLoader、OrbitControls、复位/自动旋转开关/错误重试。
- [x] 无 src 时为明确标注的原创几何测试模型；有 src 时真实加载 GLB。
- [x] `app/lab/demo.glb/route.ts` 返回自己生成的小型有效 GLB，非占位模型路径。
- [x] 按需渲染、离屏暂停、reduced-motion、GPU清理、可见的普通文字控制。

## Task 4 — 文件浏览与后台管理（DS）

- [x] `components/resources/resource-browser.tsx` 及 CSS Module，依赖API列目录、面包屑、分页、私有/空/错误状态。
- [x] `components/admin/resource-manager.tsx` 与 `/admin/(shell)/resources/{page.tsx,actions.ts}`，原生表单逐项录入/修改/删除索引，目录可嵌套、来源格式明确。
- [x] 不把私有 URL 放进公开列表或日志，不执行远程删除。

## Task 5 — 集成、安全、验收（主代理）

- [x] `/resources` 入口、单资源页、`/lab` 实验页、项目与后台入口；Markdown 安全资源引用。
- [x] `proxy.ts` 按验证后的资源 origin、配置 origin 与两个明确测试源增加 CSP；frame 仅两类官方播放器；兼容客户端导航并保留其余限制。
- [x] `/preview` 右侧仅替换为轻量3D测试元素，不叠加更多卡片。
- [x] 固定依赖、记录配置与使用方法。
- [x] 浏览器验证视频推进与seek、GLB加载与视角、目录进出/预览、后台CRUD及匿名权限；资源测试、typecheck、build及依赖审计通过。

## Progress

- 四条 DS 实现线已集成。资源回归 11/11、typecheck、生产依赖审计通过。
- 实机验证 MP4 播放与 seek、HLS MediaSource 播放、真实 GLB、方向键/复位/旋转/Escape、私有祖先四接口 404、后台增改删、文章公开/私有资源围栏。
- 三项验收资源索引（目录、视频、模型）已通过后台确认删除，API 均 404，目录回到原先空状态；未创建文章、未发布、未转存样片。
- 客户端审查修复：编辑器不能导入 Node 资源存储；iframe 保留源站与重载入口；签名链接输入支持 8192 字符。
- 实测修复：围栏按原始语言识别、只在完整 UUID 时发起读取；320px 三维容器不溢出；下载保留相对 Location，且 Referrer-Policy 不被全局配置覆盖。
- 独立安全审查无高/中风险发现；客户端审查的三项问题已修复并复核。生产构建通过，新增资源/API/实验路由均进入产物。
- 最终重启开发服务，320px 预览完整加载 Three.js，页面宽度等于视口且无浏览器错误；测试页已关闭。
