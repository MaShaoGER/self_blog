# HANDOFF · 交接文档（新对话从这里开始）

2026-10-22 结构更新：真实运行目录默认位于源码外的 `../self_blog-data`，演示内容改在 `examples/data/`，测试草稿 `111.md` 仍保留。项目、导航和页脚可在后台编辑；手动更新与三种入口模式以根目录 `DEPLOY.md` 为准。以下内容保留此前设计交接记录。

更新时间：2026-10-18（前台改造 + 内容结构扩展已完成）
用途：在新会话中继续 self_blog 的 UI 改造。本文档自包含，读完即可接手。

---

## 0. 新对话启动指令（可直接复制）

> 先读 `AGENTS.md`、`docs/design-references/HANDOFF.md`、`docs/design-references/design-reference.md`。
> 按其中的「工业设计平面 + 关键控件写实（80/20）」方向，继续 self_blog 的 UI 改造。
> **前台页面、登录页、后台侧栏与内容区均已完成**；剩余重点见「6. 待办」。
> 约束：不新增 UI 组件库/重型依赖；每步 `pnpm typecheck`；移动端后台可发文；
> 双主题与 `prefers-reduced-motion`；界面文案中文；设计细节按 `design-reference.md` 执行。

---

## 1. 项目现状

- 技术栈：Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS v4（无 UI 组件库）
- **前台已完成**（工业平面 + 80/20 写实控件）：
  - 首页（铭牌 + 状态块 + 精选 + 项目入口 + 参数表目录）
  - 文章页（手册式三栏：SPEC / 624px 正文 / TOC + 阅读进度；系列条 / 相关文章 / 相邻文章 / 修订表 / 评论写实控件）
  - 归档、系列索引 `+ /series/[slug]`、项目页、标签索引、标签页、搜索、关于、根级 404 + 组内 404
  - `loading.tsx`（档案骨架）/ `error.tsx`（FAULT 页）覆盖前台、后台与根级
  - 登录页 = 控制台（机柜黑、mono、版本号、LED、条码）
- **后台内容区已完成**（概览/文章/评论/图库/设备/设置 + 编辑器）；圆角胶囊与圆形按钮已按工业平面清理干净
- 路由：`/api/upload`、`/uploads/[...path]`、`/feed.xml`、`sitemap`、`robots`
- 字体依赖：`@fontsource-variable/archivo`（标题）+ `@fontsource-variable/inter`（正文）+ `@fontsource/ibm-plex-mono`（标签/编号）。
  **Fraunces 已从 package.json 移除**，不要再引入衬线。
- 数据：`data/posts/*.md`（7 篇，含长文 `grid-notes` 压测手册排版）；`data/projects.json`（项目页数据，**已从 .gitignore 移出，随仓库分发**）；
  `data/uploads/2026/10/` 3 张占位配图；`data/settings.json` 演示作者信息
- 种子系列：`版式实验`（grid-notes / version-as-promise / order-from-entropy 三册）

---

## 1.1 本轮已完成的关键实现（接手必读）

- `app/globals.css`：完整 token 层（`--paper/--ink/--accent/--signal/...` 浅深两套）+ 工具类
  （`.wrap .sheet .label .display .mono .link-underline .field .btn*`）+ 写实控件类
  （`.keybtn .groove .lever .lcd .led .plate .hazard .ruler`）+ 手册式 `.article` 排版
- **硬件材质层（v0.3，用户要求「再加点写实」后新增）**：
  `.metal / .metal-dark`（拉丝金属）、`.screw / .screw-corners`（一字槽螺丝）、
  `.grille`（网孔格栅）、`.knob / .knob-ring`（旋钮 + 11 格刻度环）、`.fader / .fader-thumb`（推子）、
  `.silk-strip`（橙底丝印条）、`.lcd-glow`（橙色荧光点阵屏）、`.led-green`
  材质变量：`--metal-hi/mid/lo/edge/sheen/text/line`、`--grille-dot`、`--knob-tick`，浅深各一套
- `components/ui/marks.tsx`：`NoMark / FigCaption / StatusLine / Barcode / Ruler / CrossBox / CornerTicks / HazardTape`
- `components/ui/hardware.tsx`：`Screw / ScrewCorners / MetalPanel / Knob / Fader / Grille / SilkStrip / GlowScreen`
- `components/ui/controls.tsx`：`KeyButton`（tone: paper/safety/ink）、`GrooveInput`
- `components/site/post-params.tsx`：`SpecSheet / MetaStrip / RevisionLog / entryNo / revNo / postCat`
- `.tools/shot.py`：CDP 截图 + 布局探针（`--probe` 可报横向溢出/字号/行宽），验收统一用它：
  `python .tools/shot.py <url> <width> <out.png> [--height N] [--dark] [--full]`
  `python .tools/shot.py --probe <url> [width] [height] [dark]`

### 写实落位（80/20 的实际分配，每页 ≤3 处）

| 位置 | 控件 | 截图 |
|---|---|---|
| 首页右上状态块 | 金属面板 + 四角螺丝 + 橙色荧光屏 + 旋钮 + 丝印条 | `13-panel-detail.png` |
| 文章页左栏 SPEC | 小金属铭牌 + 丝印条 | `03-post-1440.png` |
| 文章页评论区 | 金属面板 + 螺丝 + 网孔格栅 + 凹槽输入 + 键帽提交 | `14-comment-panel.png` |
| 全站右上 | 主题拨杆（橡胶手柄） | 各页 header |
| 登录页 | 整页控制台（机柜黑 + mono + 条码） | `11-login-1440.png` |
| 代码块工具条 | 语言铭牌 + 复制键 + 成功亮绿灯 LED | `.tools/shots/final/code-copied-1440.png` |
| 图片灯箱 | 机柜黑全屏 + 顶栏 mono 标签 + 底部图注 | `.tools/shots/final/lightbox-1440.png` |
| 文章页阅读进度 | 1px 凹槽刻度 + 橙色进度段 + 游标 + mono 读数 | `.tools/shots/final/post-1440.png` |

其余区域保持工业平面（纸白、1px 结构线、mono 编号），不再加控件。

**已知 deviation**：文章页三栏布局在 xl（1280）以下退为两栏 —— 正文 624px + SPEC 192px 已占满 1024 宽度，
右栏 TOC 会被挤到 48px（竖排一字一行）。因此 **TOC 与阅读进度在 xl 起才展开为常驻右栏**，
1024–1279 与移动端改用正文上方的折叠目录（`TocMobile`），短文无 TOC 时进度条常驻正文上方。

**材质注意事项**（踩过的坑）：
- `repeating-conic-gradient` 才能画出多格刻度环，普通 `conic-gradient` 只画第一格。
- 旋钮刻度环的 `mask` 必须放在独立伪元素上，直接放在容器上会裁掉旋钮本体。
- 金属面板内部文字不要硬编码颜色，用 `currentColor`/`opacity` 继承 `.metal` 的 `--metal-text`，
  否则深色主题下会出现浅色面板配深色字的错配。
- 站头含 tagline 实际高约 96px，sticky 偏移要用 `top-[6.5rem]`，`top-20`(80px) 会被站头压住。
- 列表行的 1px 编码条要限宽（`max-w-[14rem]` / `[18rem]`），整行宽度会被读成标题下划线。

---

## 1.2 环境陷阱（务必遵守）

1. **不要把 `>` 重定向 / here-string / `Set-Content` 用于含中文的文件**。Windows PowerShell 默认
   按 GBK 读入，会导致 mojibake 与吞引号（本轮已发生一次，4 个文件被毁，dev server 500）。
   → 只用 `write`/`edit` 工具写文件。
2. **Turbopack 增量 CSS 管线会卡住**：HTML 更新但 CSS 产物不更新，表现为新类名不生效。
   → 表现为「改了但样式没变」时，直接杀掉 next dev、`Remove-Item .next -Recurse`、重启。
3. dev server 端口不固定（本轮先后用过 3123 / 3000）；用 `Get-NetTCPConnection -LocalPort` 确认。

---

## 2. 设计方向（已定稿）

**工业设计平面 + 关键控件写实（80/20）。**

一句话：把工业平面设计（产品目录、技术图纸、铭牌标签、设备手册、品牌档案）的版式语言直接排成网页；页面 80% 保持平面，20% 关键交互控件做写实质感；不做拟物硬件整站，不做圆角卡片模板。

关键词：`ARCHIVE` · `TECHNICAL` · `UTILITARIAN`

- **不采用**：早期暖纸 + 陶土橙编辑风（存档于 `README.md`）；整站拟物（`industrial.md` 仅保留少量微交互参考）。
- **参考气质**：Teenage Engineering / Playdate / Analogue 的产品页；People's Graphic Design Archive、Internet Archive Manuals、Google Patents 的档案排版；DEIMOS、Build 的工业海报；Klevgrand、Goodhertz 的插件拟物控件。

---

## 3. Token 速查（完整版见 design-reference.md）

**色彩**

| 角色 | 值 | 用法 |
|---|---|---|
| PAPER | `#EFEBE3` | 页面底 |
| MINT | `#D3E4D6` | 区块底 / 档案卡 |
| INK | `#17171A` | 正文 / 结构线 |
| SAFETY ORANGE | `#E8531F` | 主强调（链接、分类、按钮、当前项） |
| SIGNAL PINK | `#FF2D6F` | 次强调（编号、标记、选中，≤5%） |
| GREY | `#B7B1A5` | 边框、次级信息 |
| DARK | `#111113` / `#1A1A1C` / `#E8E4DA` | 深色主题：底 / 面板 / 文字 |

面积 68/20/8/4（纸白/墨黑/橙/粉）；不用纯黑纯白。

**字体**

- 标题：Archivo 800–900；中文 思源黑体 Heavy；64px / 0.95 / -0.02em
- 正文：Inter 400/500 + 思源黑体；16–17px / 1.75 / 行宽 62–68ch
- 标签：Archivo Narrow 500 或 IBM Plex Mono 500；11px 全大写 +0.08em
- 编号/图注：IBM Plex Mono；10–12px
- **不再使用 Fraunces**

**栅格**：12 列 / gutter 24 / 页边距 32（移动 20）/ max 1440 / 8pt 基线；首页与档案页 40px 细网格，文章页关闭。

**图形语言**：叉框、裁切角标、条码、刻度、警示斜纹、贴纸、十字定位、虚线安全框、编号前缀、套印偏移（1px 橙/粉）；每屏 ≤3 类标记，标记必须承载信息。

**图像**：统一 4:3、1px INK 边框、零圆角、去饱和 90–100%；图注 `FIG. 01 — 说明 / 来源 / 年份`（mono 11px）。

**写实控件（80/20，只放交互点）**

- 材质：塑料 `#F4EFE4→#D6CEC0`、橡胶 `#232326`、金属、LCD 绿 `#C8E85A` / 橙 `#FF9C4A`
- 光照：左上 45°；高光 1px、暗边 2px、阴影 ≤3 层
- 规格：键帽按钮（高 40–44，3px 实体阴影，按下位移 3px）、拨杆（主题切换）、旋钮（−135°～135°，慎用）、凹槽输入框、LCD 状态屏、LED 状态灯、丝印标签（Arial Narrow 700 / 11px / +0.22em）
- 只用于：主题切换、订阅/发布、搜索、分页、评论区、阅读进度、后台发布
- 必须原生 `button/input/a`，键盘可操作、有焦点态、尊重 `prefers-reduced-motion`

---

## 4. 文件与素材索引

| 路径 | 内容 |
|---|---|
| `docs/design-references/design-reference.md` | **主文档**：方向、token、页面版式、组件规格、实现映射、反例、验收清单、写实控件章节 |
| `docs/design-references/design-board.html` / `.png` | 设计板（色彩/字体/标记/组件/参考图） |
| `docs/design-references/controls-board.html` / `.png` | 写实控件板（可浏览器打开直接改样式） |
| `docs/design-references/graphic-industrial.md` | 工业平面外部参考站清单（带截图索引） |
| `docs/design-references/industrial.md` | 拟物硬件网页参考（仅微交互参考，形态不采用） |
| `docs/design-references/README.md` | 早期暖纸编辑风参考（归档，勿采用） |
| `docs/design-references/source/01–12` | 用户提供的 12 张参考图（含产品渲染、工业海报、标签、DEIMOS 等） |
| `docs/design-references/gr-picks-*.png` / `graphic-sheet-*.png` | 外部站截图总览 |
| `docs/design-references/skeuo-sheet-*.png` | 拟物控件参考截图 |

外部重点链接（详见 `graphic-industrial.md` 第 2 节与 `design-reference.md` 第 11.6 节）：
- 工业平面档案：peoplesgdarchive.org、archive.org/details/manuals、patents.google.com、designreviewed.com、computerhistory.org、emuseum.ch
- 工业设计：takram.com、zak.group、presentandcorrect.com、counter-print.co.uk、nendo.jp、naotofukasawa.com
- 写实控件：teenage.engineering、play.date、analogue.co、elektron.se、poolsuite.net、learningmusic.ableton.com、musiclab.chromeexperiments.com、klevgrand.se、goodhertz.com、soundtoys.com
- 实现参考：joshwcomeau.com/animation/3d-button、jdan.github.io/98.css、Home Assistant "Skeuo Cards"

---

## 5. 决策时间线

1. **最初方向**：暖纸 `#f4f0e8` + 陶土橙 `#bf4f28` + 编辑排版（旧 AGENTS.md 设计取向）。
2. **转向拟物硬件网页**（`industrial.md`，Teenage Engineering 类）——用户否定"整站模拟机器"的理解。
3. **转向工业设计平面**（`graphic-industrial.md`）——用户确认这是想要的方向，采用为基底。
4. **补充写实控件**（`controls-board`）——用户要求"控件走写实"，最终定为 80/20 混合。

---

## 6. 待办 / 建议顺序

**已完成（累计）**

1. ✅ 全局 token / 字体替换（移除 Fraunces，接 Archivo + IBM Plex Mono）/ 噪点与网格底 / 双主题
2. ✅ 前台首页（铭牌 + 状态块 + 参数表目录 + 精选 + 规格页脚）
3. ✅ 文章页（手册式：SPEC 左栏 + 624px 正文 + TOC 右栏 + 章节编号 + 图注 + 修订表 + 评论写实控件）
4. ✅ 归档 / 标签索引 / 标签页 / 搜索 / 404（含根级 404）
5. ✅ 导航 / 页脚（编号与丝印语言）
6. ✅ 写实控件组（主题拨杆、键帽按钮、凹槽输入框、LED、LCD 类、条码/刻度标记）
7. ✅ 登录页（控制台风格）+ **后台全部六个页面与编辑器**
8. ✅ **内容结构扩展（本轮）**：系列（`/series`、`/series/[slug]`、编辑器 series 字段）、
   项目（`/projects`、`data/projects.json`、首页入口）、相关文章、文章页阅读进度
9. ✅ **阅读层（本轮）**：代码块语言铭牌 + 复制键、图片灯箱、系列条
10. ✅ **全站健壮性**：前台/后台/根级 `loading.tsx` + `error.tsx`、sitemap 收录系列与项目、
    404 补新入口、导航（系列/项目，md 以下收进页脚）
11. ✅ 验收：1440 / 1280 / 1024 / 768 / 390 五档 × 14 条路由无横向溢出；深浅主题；
    `pnpm typecheck` 与 `pnpm build` 均通过

**待办（下一步）**

1. **分享层**（未做）：动态 OG 图（`next/og` 生成铭牌式封面，需自托管中文字体子集）、
   JSON-LD（BlogPosting / Person / WebSite）、RSS 全文（当前只有摘要）。
2. 键盘走查全站、`prefers-reduced-motion` 逐项确认（progress / 灯箱 / 复制已覆盖）。
3. 200 篇文章的列表性能与图片懒加载。
4. 打印样式（档案页 A4，`@media print` 目前只隐藏 `.no-print`）。
5. 中文正文行宽在 768–1024 之间的中间态（当前 624px 固定，窄屏依赖自然换行）。
6. `data/posts/111.md` 是作者自己的测试草稿（draft），勿删。

每步之后 `pnpm typecheck`；UI 改动后用 `.tools/shot.py` 截图 + `--probe` 验证
（`D:\project\self_blog`，`pnpm dev`，端口以实际监听为准）。

**环境补充**：
- `.tools/shot.py` 依赖 Python `websocket` 模块，系统 Python 没有；用工作区自带 Python 跑：
  `C:\Users\admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe`
- Playwright 装在系统 Python（`python -m playwright`），chromium 未装，用 `channel="msedge"` 走系统 Edge。
- **`pnpm build` 前必须先停掉 `pnpm dev`**：dev server 会锁 `.next/dev-run.log`，导致
  `EBUSY: resource busy or locked, unlink`。顺序：停 dev → 删 `.next` → build → 重启 dev。

---

## 7. 约束与注意

- 无 UI 组件库；不新增数据库/ORM/重型依赖；新增依赖需说明理由。
- 字体体积控制：中文用系统黑体回落或自托管子集；数字/标签用 IBM Plex Mono。
- 后端逻辑不得在客户端组件中引用 node 内置模块；组件边界沿用现有结构。
- 界面文案中文，代码注释少而准。
- 用户重视：不模板感、细节精致、响应式、双主题；**不要擅自扩大范围**。
- 旧文档与旧方向材料保留，不要删除；新方向以 `design-reference.md` 为准。
- 参考图/截图仅作视觉参考，不要直接当页面素材（版权与分辨率问题）。
- 写含中文的文件只用 `write`/`edit` 工具，禁用 pwsh 重定向（见 1.2 环境陷阱）。

---

## 8. 待用户确认

- 写实控件比例维持 80/20 还是再加重/减轻？（当前落地：每页 1–3 个写实控件，集中在主题切换、主按钮、搜索框、评论表单、代码块工具条）
- 是否要做「分享层」（动态 OG 图 / JSON-LD / RSS 全文）—— 动态 OG 图需自托管中文字体子集，是唯一有额外成本的一项。
- `data/posts/` 里的 7 篇种子文章与 3 张占位配图是否保留（用于版式验证，可随时删除）。
- `data/projects.json` 里的 3 条示例项目是占位数据，是否换成真实项目。
