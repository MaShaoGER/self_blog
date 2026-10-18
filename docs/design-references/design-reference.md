# self_blog 设计参考 · 工业设计平面系统

版本 v0.1 · 2026-10-18
依据：三轮讨论 + 你提供的 7 张参考图整理。以后做页面、组件、插图、文案都以这份为准。
配套：`design-board.png`（设计板）、`source/`（参考图归档）、`graphic-industrial.md`（外部链接清单）。

---

## 0. 一句话方向

**把工业平面设计直接排成网页**：产品目录、技术图纸、铭牌标签、设备手册、品牌档案的版式语言；
用栅格、编号、等宽字与纸白/墨黑/安全橙来组织内容，图片当档案处理。
不做可点击的拟物硬件，也不做圆角卡片堆叠的模板博客。

关键词：`ARCHIVE` · `TECHNICAL` · `UTILITARIAN`

---

## 1. 方向与边界

- **采用**：工业设计平面（graphic industrial）。视觉主体是"排版与档案"，不是"产品照片墙"。
- **替代**：暖纸 + 陶土橙的编辑风（旧方案，存档于 `README.md`）。
- **仅作补充**：拟物硬件网页（`industrial.md`），只有微交互手势可借用，整体形态不采用。
- **气质锚点**：设备铭牌 / 专利图纸 / 产品目录 / 技术手册 / 设计档案 / 瑞士国际主义排版。

---

## 2. 参考来源

### 2.1 你提供的参考图（已归档到 `source/`）

| 文件 | 内容 | 抄什么 |
|---|---|---|
| `01-mspt-cd-player.png` | MSPT 便携 CD 机概念渲染 | 拟真产品图 + 丝印标签 + 米色/藏蓝/荧光绿配色 |
| `02-hardware-panel-orange.png` | 硬件参数面板概念 | 灰色面板、橙色拨钮、刻度、密集小标签、单色底 |
| `03-retro-device-ui.png` | 90s 设备等距插画 | 线稿 + LCD 绿屏 + 灰阶面板；线稿可作文章配图风格 |
| `04-ssa-fpc-collage.png` | 板卡/柔性电路拼贴 | 零件平铺、编号表、QR/条码、灰底 + 橙色 FPC |
| `05-synthetic-logistics-labels.png` | 数据标签/包装设计 | 橙黑标签、mono 参数、条形码、裁切框、技术说明段 |
| `06-deimos-order-from-entropy.png` | DEIMOS 技术排版海报 | 薄荷绿底 + 黑大字 + 荧光粉块 + 细网格 + 编号/线稿 |
| `07-build-printed-communication.png` | Build 工作室海报 | 橙底 + 黑/白模块 + 技术标签文本 + 斜纹块 |

### 2.2 外部参考（截图见 `gr-picks-archive.png` / `gr-picks-studio.png` / `gr-picks-press.png`）

- **档案/图录**：[People's Graphic Design Archive](https://peoplesgdarchive.org) ★★、[Internet Archive Manuals](https://archive.org/details/manuals) ★★、[Google Patents](https://patents.google.com) ★★、[Design Reviewed](https://www.designreviewed.com)、[Computer History Museum](https://www.computerhistory.org/collections/catalog/)、[eMuseum Zürich](https://www.emuseum.ch)
- **工业设计工作室**：[Takram](https://www.takram.com) ★、[Zak Group](https://www.zak.group) ★、[Present & Correct](https://www.presentandcorrect.com) ★、[Counter-Print](https://www.counter-print.co.uk) ★、[nendo](https://www.nendo.jp)、[Naoto Fukasawa](https://www.naotofukasawa.com)
- **出版/平面**：[Lars Müller](https://www.lars-mueller-publishers.com)、[Bureau Borsche](https://bureauborsche.com)、[Unit Editions](https://uniteditions.com)、[OK-RM](https://ok-rm.co.uk)、[Build / Michael C. Place](https://www.michaelcplace.com) ★
- **图片源**：[Yanko Design](https://www.yankodesign.com)、[Core77](https://www.core77.com)、[Dribbble #industrial](https://dribbble.com/tags/industrial)、[Fonts In Use](https://fontsinuse.com)；Behance/Pinterest 搜索 "industrial concept render"、"technical label design"。

---

## 3. 设计 token

### 3.1 色彩

| 角色 | 值 | 用法 |
|---|---|---|
| PAPER | `#EFEBE3` | 页面底色（浅色主题） |
| MINT | `#D3E4D6` | 外壳色：区块底、hover 底、档案卡底色 |
| INK | `#17171A` | 正文、结构线、按钮描边（不用纯黑） |
| SAFETY ORANGE | `#E8531F` | 主强调：链接、分类、按钮、当前项 |
| SIGNAL PINK | `#FF2D6F` | 次强调：编号/标记/选中态，占比 ≤ 5% |
| GREY | `#B7B1A5` | 边框、次级信息、禁用态 |
| DARK BG | `#111113` | 深色主题底 |
| DARK SURFACE | `#1A1A1C` | 深色主题卡片/输入框 |
| DARK TEXT | `#E8E4DA` | 深色主题正文 |

面积建议：纸白 ~68% / 墨黑 ~20% / 橙 ~8% / 粉 ~4%。
对比度：INK on PAPER ≈ 15.8:1；白字 on 橙 ≈ 4.8:1（小字需换黑字或加深橙到 `#C9430F`）。

### 3.2 字体

| 角色 | 字体 | 规格 |
|---|---|---|
| 展示标题 | Archivo / Archivo Expanded 800–900；中文 思源黑体 Heavy | 64px / 0.95 / -0.02em |
| 章节标题 | Archivo 700；中文 思源黑体 Bold | 40 / 28px / 1.05 |
| 正文 | Inter 400/500 + 思源黑体 400 | 17px / 1.75 / 0 字距，行宽 62–68ch |
| 标签 | Archivo Narrow 500 或 IBM Plex Mono 500 | 11px / 全大写 / +0.08em |
| 编号/数据/图注 | IBM Plex Mono 400/500 | 10–12px / +0.06em |

不引入衬线体（移除 Fraunces）。中文正文用系统黑体或思源黑体子集，英文数字统一 Inter/Plex Mono，避免中英混排跳脱。

### 3.3 栅格与间距

- 12 列 / gutter 24px / 页边距 32px（桌面）、20px（移动）/ 最大宽度 1440px
- 内容主栏 720px，侧栏 280px；8pt 基线（4px 半格）
- 首页与档案页显示 40px 细网格（`rgba(0,0,0,.04)`），文章页关闭
- 断点：390 / 768 / 1024 / 1440

### 3.4 图形语言

允许的标记：叉框、裁切角标、条码、刻度尺、警示斜纹、贴纸、十字定位、虚线安全框、编号前缀（NO./FIG./CAT./REV.）、页码。
**使用原则**：每屏 ≤ 3 类标记；标记必须承载信息（编号、状态、关联），不为装饰而加。
标题可做 1px 橙/粉套印偏移，只在 hover 或入场时复位。

### 3.5 图像

- 统一 4:3，1px INK 边框，零圆角
- 处理：去饱和 90–100%、对比 +5%；可加 3% 噪点；线稿直接单色输出
- 图注：`FIG. 01 — 说明 / 来源 / 年份`（mono 11px，灰）
- hover：显示虚线安全框与 `VIEW / 01` 角标
- 禁止：投影、圆角、渐变蒙层、彩色滤镜

### 3.6 动效

- 入场一次：网格线展开 / 编号计数 / 标题错位复位，180–260ms ease-out
- hover：行底色 `rgba(23,23,26,.03)`、箭头右移 4px、贴纸倾斜 0→-1°
- 按钮：`translateY(2px)` + 阴影 3px→1px（键帽手感）
- 状态 LED 呼吸 3s（可关）
- 全部包 `@media (prefers-reduced-motion: reduce)` 关闭

---

## 4. 页面版式

### 4.1 首页（铭牌 / 目录）

```
┌ SELF_BLOG ─────────── ARCHIVE / NOTES / ABOUT ── 2026.10.18 ─ RSS ┐
│ 站名大标题（中文）                 │  STATUS BLOCK            │
│ SELF_BLOG — 一行说明               │  ARCHIVE 2019–2026       │
│                                    │  48 ENTRIES / UPD 10.18  │
├────────────────────────────────────┴──────────────────────────┤
│ NO.   TITLE                              DATE        CAT  MIN  │
│ 042   Order From Entropy                 2026-10-18  ES·  12   │
│ 041   ...                                                      │
├────────────────────────────────────────────────────────────────┤
│ 精选：3 张 4:3 档案图 + 编号 + 标题                             │
├────────────────────────────────────────────────────────────────┤
│ 规格表（搭建 / 栈 / 更新 / RSS）        条码   © 2026           │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 档案页 ARCHIVE

左侧筛选栏（年份 / 分类 / 搜索框），右侧 3 列档案网格：
每格 = 封面（4:3）+ `NO.0XX` + 标题 + 年份；顶部计数 `48 ENTRIES / 2019–2026`。

### 4.3 文章页（手册页）

- 顶部：`NO.042` + 大标题 + 副标题；meta 行 `DATE / WORDS / CAT / READ`
- 桌面左侧 sticky 参数栏（DATE、WORDS、TAGS、VERSION），移动端折叠为标题下参数块
- 正文 62ch；H2 前缀 `01 / 02`；引用块 1px 边 + 橙竖线
- 配图 1px 边 + mono 图注；文末"修订记录"表 + 编号式上下篇 + 评论（终端风格输入框）

### 4.4 About（铭牌）

两栏：左简介（中文 ≤ 200 字）+ 右规格表（坐标 / 职业 / 设备 / 联系）；底部站点参数表（建造时间 / 技术栈 / 更新频率 / RSS / 版权）。

### 4.5 搜索页（检索）

终端式搜索框 + 表格结果行；空态 `NO RECORDS FOUND / TRY ANOTHER QUERY`。

### 4.6 登录与后台

登录页 = 控制台：深色底、mono、版本号、状态灯。
后台保持灰白文档界面（可读性优先），列表用参数表，编辑器工具栏做成工具条，不做过度的拟物。

---

## 5. 组件规格

- **Header**：高 64px，底边 1px INK；左 logotype（等宽型号式），右导航 11px 大写 + 日期/RSS。
- **ArticleRow**：grid `96px 1fr 118px 82px 62px 34px`，行高 72px，上下 1px 线；hover 底色 + 箭头位移。
- **Tag**：mono 10px 大写，橙底白字（或 1px 边透明底），padding 6/10；可倾斜 -1° 做贴纸。
- **Button**：高 40px，2px 描边，3px 实体阴影；active 下移 2px。
- **Input**：1px 边，mono 12px，focus 2px 橙 outline，无圆角。
- **Figure**：1px 边，图注 mono 11px，`FIG. 0X` 前缀。
- **StatusLine**：LED 6px 圆点 + mono 文本，绿色 `#2F7A3C`。
- **Pagination**：`PREV / 01 / 02 / NEXT` 形式，mono 大写。
- **TOC**：编号列表，当前项橙点。
- **Comment**：输入框 + 提交按钮，全 mono，显示时间戳。

---

## 6. 文案语气

- 短、名词化、说明性；先结论再参数。
- 编号统一：文章 `NO.2026-042`，图 `FIG. 01`，版本 `REV.02`。
- 界面动作词：`READ ENTRY` / `VIEW ALL` / `SEARCH` / `SUBSCRIBE`；中文界面可用"阅读 / 全部 / 检索 / 订阅"。
- 状态文案：`SYS.ONLINE`、`48 ENTRIES`、`LAST UPDATE 2026.10.18`——克制使用，不滥用英文字母缩写。
- 禁忌：不用"欢迎来到我的博客"、不用感叹号、不用 emoji、不用营销词。

---

## 7. 双主题

- **浅色**：PAPER 底 + INK 字 + MINT 区块 + 橙/粉强调（主用）
- **深色**：`#111113` 底 + `#1A1A1C` 面板 + `#E8E4DA` 字 + 同色橙/粉（像机柜/暗室）
- 跟随系统偏好，右上角提供 `LGT / DRK` 切换（文字按钮，不用图标开关）
- 深色主题下网格线、边框透明度需单独调（`rgba(232,228,218,.08)`）

---

## 8. 实现映射（Next 16 App Router + Tailwind v4）

```css
@theme {
  --color-paper: #EFEBE3;
  --color-mint: #D3E4D6;
  --color-ink: #17171A;
  --color-safety: #E8531F;
  --color-signal: #FF2D6F;
  --color-grey: #B7B1A5;
  --color-dark-bg: #111113;
  --color-dark-surface: #1A1A1C;
  --color-dark-text: #E8E4DA;
  --font-display: "Archivo", "Noto Sans SC", sans-serif;
  --font-body: "Inter", "Noto Sans SC", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;
  --font-label: "Archivo Narrow", "Noto Sans SC", sans-serif;
  --spacing: 4px;
}
```

- 字体：`next/font/google` 加载 Archivo / Inter / IBM Plex Mono / Noto Sans SC；中文字体体积大，生产环境建议自托管子集或用系统黑体回落。
- 网格背景：`repeating-linear-gradient` 或 SVG pattern，`pointer-events:none`。
- 噪点：内联 SVG `feTurbulence` data URI，`position:fixed`，`opacity:.03`，`mix-blend-mode:multiply`。
- 角标/叉框/条码用纯 CSS/SVG 组件实现，不切图。
- 文章 frontmatter 增加：`no`（编号）、`cat`（分类）、`rev`（修订）。
- 列表语义用 `ul/li`，视觉用网格；不要用 `table` 排文章（除档案页可选表格）。

---

## 9. 反例（不要出现）

- 渐变紫、玻璃拟态、大圆角卡片 + 统一软阴影
- 满屏荧光色、故障艺术、赛博朋克霓虹
- 可点击的拟物硬件（旋钮、拨杆做成真实控件）
- 符号过载：一屏同时出现条码、斜纹、叉框、刻度、贴纸
- 纯白 `#fff` / 纯黑 `#000`；广告感 CTA
- emoji 当图标；"卡片瀑布流"

---

## 10. 验收清单

- [ ] 390 / 768 / 1024 / 1440 四档正常，移动端文章可读
- [ ] 正文对比度 ≥ 4.5:1，focus-visible 清晰
- [ ] 键盘可走完全站；reduced-motion 生效
- [ ] 列表 200 篇滚动流畅；图片懒加载
- [ ] 深色/浅色主题视觉一致，无纯白纯黑
- [ ] 打印样式（档案页 A4 可打印）
- [ ] 首屏无字体闪烁（font-display: swap + 预加载）
- [ ] 无圆角 > 4px 的卡片；渐变只允许出现在图像处理中

---

## 11. 写实控件（v0.2 补充）

设计板：`controls-board.png` / `controls-board.html`

### 11.1 原则

- **80 / 20**：页面 80% 保持工业平面（纸白、栅格、mono 编号），20% 关键控件写实。
- 写实控件只放在**交互点**：主题切换、订阅、搜索、分页、评论区、播放/阅读进度、后台发布按钮；正文阅读区保持平面。
- 写实是皮肤不是替代：必须用原生 `button / input / a`，保留键盘、焦点、ARIA。
- 一个页面最多 3–5 个写实控件，其余保持平面，避免"玩具化"。

### 11.2 控件规格

| 控件 | 规格 | 用途 |
|---|---|---|
| 按钮 | 高 40–44px，圆角 3px，顶部 1px 高光 + 3px 实体阴影，按下位移 3px | 订阅 / 发布 / 保存 |
| 拨杆 | 轨道 66×28 凹槽，手柄 27×22 橡胶，两态 | 主题切换、后台开关 |
| 旋钮 | 88px 塑料 + 黑色帽 + 白色指示线；外圈 11 刻度；−135°～135° | 音量/阅读进度（可选，慎用） |
| 滑块 | 12px 凹槽轨道 + 24×30 橡胶推子 | 阅读进度、字号 |
| LCD | 黑底荧光字 + 扫描线 + 微泛光；绿 `#C8E85A` / 橙 `#FF9C4A` | 最新文章、状态、阅读时长 |
| 输入框 | 凹槽刻槽（内阴影），mono 12px，focus 2px 橙 outline | 搜索、评论昵称 |
| LED | 9px 圆 + 径向渐变 + 光晕 | 在线/警告/录制状态 |
| 贴纸/丝印 | Arial Narrow 700、11px、字距 .22em、大写、`#4A463D` | 面板标签、图注 |

### 11.3 材质 token

- PLASTIC：`#F4EFE4 → #D6CEC0`（155° 渐变，顶部 1px 白高光，边缘 1px `#B3AC9C`）
- RUBBER：`#46464A → #232326`（推子/手柄）
- METAL：`#E0D9C9 → #B9B4A8`（横向 1px 拉丝纹理）
- LCD：底 `#10160E`，字 `#C8E85A`（橙变体 `#160D08` / `#FF9C4A`）
- 光照：统一左上 45°；高光 1px `rgba(255,255,255,.75)`；暗边 2px `rgba(0,0,0,.15)`；阴影 ≤ 3 层
- 面板噪点：SVG feTurbulence，opacity 6%，multiply

### 11.4 字体与丝印

- 丝印：Arial Narrow / Archivo Narrow 700，11px，字距 +0.22em，大写
- LCD：DSEG7 / DotGothic16（可选），或 Consolas + `text-shadow` 泛光
- 按钮标签：IBM Plex Mono 500，11px，字距 +0.12em

### 11.5 动效与声音

- press 80ms、toggle 120ms、knob 惯性 60ms；阴影随位移收缩
- 可选音效：click / toggle 3–8ms，默认静音，设置里开
- `prefers-reduced-motion` 下只保留颜色变化

### 11.6 参考

- **真实网站**：[Teenage Engineering](https://teenage.engineering)、[Playdate](https://play.date)、[Analogue](https://www.analogue.co)、[Elektron](https://www.elektron.se)、[Poolsuite](https://poolsuite.net)、[Ableton Learning Music](https://learningmusic.ableton.com)、[Chrome Music Lab](https://musiclab.chromeexperiments.com)、[Klevgrand](https://klevgrand.se)、[Goodhertz](https://goodhertz.com)、[Baby Audio](https://babyaud.io)、[Soundtoys](https://www.soundtoys.com)、[UAD](https://www.uaudio.com)、[System7](https://system7.app)
- **实现**：[Josh Comeau 3D Button](https://www.joshwcomeau.com/animation/3d-button/)、[98.css](https://jdan.github.io/98.css/)、[Skeuo Cards（CSS/SVG）](https://community.home-assistant.io/t/skeuo-cards-14-skeuomorphic-lovelace-cards-all-css-and-svg/1023310)、[Dribbble #skeuomorphic](https://dribbble.com/tags/skeuomorphic)
- **素材**：Knobs / Wheels / Sliders Mega UI Kit（GraphicRiver）、Mega UI Kit（Dribbble）
- **归档参考图**：`source/08` 写实设备渲染、`source/09` 示波器产品页、`source/10–12` 工业排版海报

### 11.7 反例

- 全站拟物（正文区也做凹凸/投影）
- 控件宽于 1/3 屏、阴影超过 3 层
- 旋钮/滑块不可用键盘操作
- 用低清 PNG 贴图代替 CSS，暗色主题下发灰
- 阅读区出现"噪声"控件（读者在文章里被控件分心）

---

## 12. 下一步

1. 确认方向（或调整 token）。
2. 按本文档出首页 + 文章页视觉稿（静态 HTML 或直接进 Next 路由）。
3. 确认后更新 `AGENTS.md` 的设计取向一节，替换暖纸方案。
