# 正式媒体功能与编辑器视频插入

> **For agentic workers:** 执行约定文件归属；后端视频与编辑器 UI 独立实现，主代理处理去实验化与最终验证。

**Goal:** 保留原博客主题，将资源/视频/GLB 能力作为正式功能；文章编辑器直接上传本地视频或粘贴视频网站链接。

**Architecture:** 复用 `resource` Markdown 围栏与现有 VideoPlayer。新增视频 API 校验并登记“不列目录”的资源，避免未发布文章的视频出现在公开资源目录；按 ID 预览仍可访问，等同原有上传图片的公开链接语义，不是私有文件保险库。视频按流写入 `BLOG_DATA_DIR/uploads/videos`，原子落盘，响应支持 Range/HEAD。

**Tech Stack:** 现有 Next16/React19/TS/JSON 原子持久化；不新增依赖。

**Spec:** 用户明确批准功能并入正式项目、保持之前主题、不要测试样式；增加本地视频与视频网站链接插入。无需更换主题、推送或公网部署。

## Global Constraints

- 正式首页、全站主题和字体保持原样，删除 `/preview`、`/lab`、测试 GLB 与样片入口。
- 保留正式 `/resources`、后台资源管理、实际 GLB 加载器及视频播放器。
- 本地视频单文件最多 200 MiB，MP4/WebM；实际文件头与 MIME/扩展名相符，随机文件名，禁止路径注入，上传中断和失败清理临时文件。
- 继续原有账号和同源校验；新增 API 不允许匿名写入。
- `listed?: boolean` 默认 true；编辑器插入资源 listed=false，不列匿名目录，但 UUID 访问可公开播放。私有权限沿祖先继承仍优先，listed 不是权限。
- 视频网站仅支持当前播放器已有的 YouTube/哔哩哔哩，规范化其完整 URL；短链接不作任意后端抓取。直链支持 MP4/WebM/HLS，未知 URL 明确要求格式，不假装万能解析。
- 本地存储是用户本轮明确选择，覆盖此前大文件外置偏好；不移除外链方式。
- 不提交用户的 AGENTS.md 等不相关变更，不推送、不部署；测试只写入自有临时目录和可精确清理的验收资源。

## Review Focus

- 无标题草稿上传不会把资源列入公开目录。
- Range、后缀 Range、HEAD、416 与视频实际字节一致，不能整文件读入内存。
- 超限、伪 MIME、截断、请求中断不会留下可播放的半成品。
- 上传/链接插入保持打开弹窗前的光标位置，不破坏原有图片上传与自动保存。
- 删除实验样式不删除正式模型加载、已保存资源或运行数据。

## Task 1 — 视频后端（DS）

- shared/video-links.ts：纯 URL 规范化，导出 parseVideoLink(url:string,format?:VideoLinkFormat):ResourceSource；抛 VideoLinkError(message)。
- lib/videos.ts：流式存储与分段读取 helper；/api/videos POST 接受 JSON 链接或原始 video/mp4、video/webm 请求体，返回 VideoInsertResult。
- app/uploads/[...path]/route.ts：只增加已验证的 videos/UUID.mp4|webm 路径；原图片 GET 保持，视频 GET/HEAD 支持 Range。
- shared/resource-types.ts / resource-validation.ts / lib/resources.ts：listed 可选字段、匿名列表过滤；现有索引兼容，权限与腐坏数据保护不退化。
- tests/videos.test.mjs、tests/resources.test.mjs：覆盖真实文件读写、范围、超限/伪头/中断、网站地址规范化、不列目录仍可按 ID 访问、私有优先。

## Task 2 — 编辑器视频插入（DS）

- components/admin/editor/video-dialog.tsx：原生 dialog，上传/链接两种模式、进度、取消、错误、键盘焦点与窄屏；调用 /api/videos，不改变主题。
- components/admin/editor/editor.tsx：工具栏增加插入视频，保存 selection，成功插入 ```resource UUID```，预览复用现有链路；不以文件名/网站标题直接拼接不安全 Markdown。
- 不编辑后端、资源后台 UI 或实验页面。

## Task 3 — 正式化与整合（主代理）

- 删除实验页面、代码与样式，清理入口和 CSP 测试来源；模型预览去掉内置测试几何及 compact 专用逻辑，只接受真实 src。
- 后台资源表单保留 listed 状态，说明未列目录资源；正式页面沿用现有主题。
- 更新文档和脚本；测试本地上传到编辑预览、分段播放、YouTube/B站插入、资源目录不泄露、实验路由 404。
- 运行聚焦回归、typecheck、build，检查正式首页保持原版。无新增依赖。

## Rulings

- 不做 Git 分支 merge：此前代码本就位于 main 工作区，本轮“合并”落实为正式功能接入和移除试验代码；未获得推送/部署指令。
- 保留目录 CRUD，移除所有实验入口；历史设计材料作为历史说明，不作为仍可访问的功能文档。
- 新外部直链 origin 仍受 CSP 约束；已支持视频网站和本地上传不需要放宽策略。外部新域名首次使用时按既有文档完整刷新，不扩大 connect-src 到任意 HTTPS。

## Progress

- 已撤下 `/preview`、`/lab`、测试 GLB、样片组件及全部实验入口；三个旧地址实测均 404。
- 正式首页沿用原页面，已截图核对；没有改动全局主题与字体。
- 模型查看器只接收真实 src，移除内置测试物件与 compact 专用样式。
- 视频存储/API 与编辑器由两个 `pop-guochan/deepseek-v4.1-flash-1017` 实现代理分别负责，主代理处理整合与验收。
- 本地视频读取补充沿用资源继承权限，且禁用公共缓存；默认编辑器附件仍为公开但不列目录，不等于私有。
- 已实机完成本地 MP4 上传、原光标位置插入、正文内播放、YouTube/B站链接插入，未写入或发布验收文章。
- 本地视频 HEAD 200、单段 Range 206（32 字节）、不列匿名目录；改私有后匿名字节请求 404，登录请求 200；匿名上传 401。
- 修复审查发现：遮罩忽略后代键盘点击；图片/封面上传期间按既有 pending 规则暂停视频插入，避免光标位置漂移；查询串不参与路径反复解码；MP4 ftyp 必需字段及声明长度在发布前校验，文件头缓冲最多 4096 字节。
- 视频/资源相关 32 项回归均通过；typecheck 和 production build 通过。全量测试 92 项中 82 通过、10 项原有备份/部署测试因 macOS BSD tar 不支持 `--transform` 未通过，未扩大本轮范围改部署脚本。
- 两项独立审查提出的问题均已修复并静态复核。临时三项资源索引及唯一视频文件已精确清理，未删除其他数据。
- 本地开发服务已恢复；无推送、无公网部署、无新依赖。
