# AI/LLM 驱动视频剪辑：开源生态调研报告

> 调研日期：2026-09-16（星数/活跃度均通过 GitHub API 于当日核实，标注"未核实"的除外）
> 背景：zhiying 项目——headless、agent 驱动的视频生产管线，现基于 Remotion 渲染，目标是让 agent 能操控真正的专业剪辑软件（时间线、多轨、特效、调色、素材管理）。

---

## 1. TL;DR

1. **"用 agent 驾驶专业 NLE"这条路已经有人蹚出来了，且集中发生在 MCP 生态**：DaVinci Resolve（[samuelgursky/davinci-resolve-mcp](https://github.com/samuelgursky/davinci-resolve-mcp)，2.8k★，341 个工具、宣称 100% 覆盖 Resolve 官方 Scripting API）、Premiere Pro（[leancoderkavy/premiere-pro-mcp](https://github.com/leancoderkavy/premiere-pro-mcp)，369 个核心工具 + CEP/UXP 双桥）、Final Cut Pro（[dreliq9/fcp-mcp](https://github.com/dreliq9/fcp-mcp)，94 工具、FCPXML 事务化编辑）都是真实、活跃的项目。它们的架构（文件桥/脚本桥 + 分层工具 + plan-review-commit 安全模型）是我们最值得直接吸收的东西。
2. **Resolve 是自动化门槛最低的专业 NLE**：官方 Python/Lua Scripting API 覆盖时间线、媒体池、调色、Fusion、Fairlight、渲染，外部脚本在 Studio 版直接可用（免费版需 in-app bridge 绕行，[来源](https://github.com/samuelgursky/davinci-resolve-mcp)）。Premiere 依赖 ExtendScript/QE DOM（部分未公开文档），FCP 几乎没有官方 API、只能走 FCPXML + AppleScript。
3. **OpenTimelineIO（ASWF 项目，Apache-2.0）是"agent 生成时间线 → 导入任意 NLE"的成熟中间表示**：C++ 核心 + Python 绑定 + 适配器插件（FCPXML/AAF/EDL），被行业广泛部署，README 自述"natively supported in most non-linear editing applications"（[来源](https://github.com/AcademySoftwareFoundation/OpenTimelineIO)）。auto-editor 的多 NLE 导出（premiere/resolve/final-cut-pro/shotcut/kdenlive，[来源](https://github.com/WyattBlue/auto-editor)）就是这条通路的最小可行证明。
4. **"AI 一键成片"类项目（MoneyPrinterTurbo 124k★、ShortGPT 8k★）与我们目标重叠度低**：它们是模板化短视频流水线（LLM 写脚本 → 素材库配图 → TTS → FFmpeg/MoviePy 合成），不碰专业剪辑软件的时间线模型。真正可吸收的是 **auto-editor**（静音/运动检测切割 + 多 NLE 时间线导出，5.2k★，Public Domain）这类"分析工具层"。
5. **剪映/CapCut 有活跃的社区"草稿文件"API**：[sun-guannan/CapCutAPI](https://github.com/sun-guannan/CapCutAPI)（2.2k★，Apache-2.0）通过生成剪映草稿目录实现可编程剪辑，支持 HTTP + MCP 双协议——对中国市场内容管线价值很高，但属逆向非官方接口，有版本漂移风险。

---

## 2. 分方向项目清单

### 2.1 操控专业剪辑软件的 agent / 自动化层

| 名称 | 仓库/链接 | 是什么 | 活跃度/星数（核实日期 2026-09-16） | License | 对我们的价值 | 集成难度 |
|---|---|---|---|---|---|---|
| davinci-resolve-mcp | [samuelgursky/davinci-resolve-mcp](https://github.com/samuelgursky/davinci-resolve-mcp)（npm 同名，[mrsuber fork](https://github.com/mrsuber/davinci-resolve-mcp)） | 通过 Resolve 官方 Scripting API 驾驶 Resolve 的 MCP server；34 复合/341 细粒度工具 + 18 个离线高级工具（直接读写 .drp/.drt/.drx） | 2,846★，最近推送 2026-09-16，高度活跃 | MIT | ⭐⭐⭐ 最高：就是"agent 驾驶 NLE"的参考实现，且有 API 覆盖表与安全边界文档 | 低（npx 一键装；需 Resolve Studio 或 bridge） |
| DaVinci Resolve Scripting API | [官方文档（社区 wiki 镜像）](https://wiki.dvresolve.com/developer-docs/scripting-api) | Blackmagic 官方 Python/Lua 脚本 API，覆盖项目/媒体池/时间线/调色/Fusion/Fairlight/渲染 | 官方随 Resolve 版本演进（21 新增能力见 MCP README） | 随 Resolve | ⭐⭐⭐ 短期最稳的"真 NLE"控制通道 | 中（需本机跑 Resolve；免费版外部脚本被 gate） |
| premiere-pro-mcp | [leancoderkavy/premiere-pro-mcp](https://github.com/leancoderkavy/premiere-pro-mcp)（npm: `premiere-pro-mcp`） | CEP 面板桥 + ExtendScript/QE DOM 的 Premiere MCP server；369 核心工具 + UXP 95 工具 | 257★，最近推送 2026-09-16，活跃 | MIT | ⭐⭐ 工具目录和安全模型可借鉴；CEP+QE DOM 依赖 Adobe 旧栈 | 高（CEP 插件安装、QE DOM 未公开文档、版本兼容脆弱） |
| auto-cut-agent | [rafcopy/auto-cut-agent](https://github.com/rafcopy/auto-cut-agent) | Premiere 的 UXP 面板 + 本地 Node server：静音删除、重复条take 去重（LLM）、字幕 | 存在（README 已核实存在），星数/活跃度未核实 | 未核实 | ⭐ 展示 UXP 路线的轻量实现 | 中 |
| fcp-mcp | [dreliq9/fcp-mcp](https://github.com/dreliq9/fcp-mcp)（PyPI: `fcp-mcp`） | FCPXML 解析/生成/事务化编辑 + AppleScript 实控 FCP + ffprobe 媒体分析；94 工具，可跨 NLE 导出（Resolve XML / FCP7 XMEML / EDL） | 9★（个人项目），最近推送 2026-08-13 | MIT | ⭐⭐ FCPXML 工程化处理（有理数时间码、原子提交、QC）思路极好；单人项目风险高 | 中（限 macOS 15.6+） |
| fcpxml-mcp-server | [DareDev256/fcpxml-mcp-server](https://github.com/DareDev256/fcpxml-mcp-server) | 自然语言控制 FCPXML 的 MCP server（fcp-mcp README 中提到的同类） | 存在，活跃度未核实 | 未核实 | ⭐ 参考 | 低 |
| CapCutAPI | [sun-guannan/CapCutAPI](https://github.com/sun-guannan/CapCutAPI)（[ashreo fork](https://github.com/ashreo/CapCutAPI)） | 生成剪映/CapCut 草稿文件的 Python API，HTTP + MCP 双协议，9 接口/11 MCP 工具 | 2,226★，最近推送 2026-09-12 | Apache-2.0 | ⭐⭐⭐ 若目标用户用剪映，这是唯一通路；MCP agent 剪辑的部分未开源 | 低-中（草稿目录复制即可用；非官方接口） |
| capcut-mate | [Hommy-master/capcut-mate](https://github.com/Hommy-master/capcut-mate) | 开源剪映草稿生成工具，含扣子(Coze)插件 | 存在，活跃度未核实 | 未核实 | ⭐ 备选 | 低 |
| libopenshot | [OpenShot/libopenshot](https://github.com/OpenShot/libopenshot) | OpenShot 的 C++ 视频编辑库，SWIG 绑定 Python/Ruby，完整时间线/特效/关键帧/渲染 API | 1,566★，最近推送 2026-09-15 | LGPL-3.0 | ⭐⭐ 无头渲染/程序化时间线的开源后端（可替代 Remotion 做真时间线渲染） | 中 |
| MLT | [mltframework/mlt](https://github.com/mltframework/mlt) | Kdenlive/Shotcut 底层多媒体框架；`melt` CLI + C++/Python 绑定，MLT XML 即时间线格式 | 1,843★，最近推送 2026-09-14 | LGPL-2.1 | ⭐⭐ 无 GUI 服务端渲染时间线的成熟方案 | 中-高（API 偏底层） |
| Kdenlive / Shotcut / Olive | [kdenlive](https://kde.org/applications/multimedia/org.kde.kdenlive)、[shotcut](https://shotcut.org/)、[olivevideoeditor/Olive](https://github.com/olivevideoeditor/Olive) | 开源 NLE。Kdenlive 本体无官方脚本 API（[邮件列表证实](https://mail.kde.org/pipermail/kdenlive/2019-September/010628.html)），可编程性靠底层 MLT；Shotcut 靠 melt/MLT XML；Olive 仍在重写、无脚本 API（未核实细节） | — | GPL 系 | ⭐ 不作为被控目标，而是经 MLT 间接利用 | — |

### 2.2 开源 AI 自动剪辑工作流 / agent 项目

| 名称 | 仓库/链接 | 是什么 | 星数（核实 2026-09-16） | License | 对我们的价值 |
|---|---|---|---|---|---|
| auto-editor | [WyattBlue/auto-editor](https://github.com/WyattBlue/auto-editor) | CLI 静音/运动检测自动剪辑；`--export` 直出 Premiere/Resolve/FCP/Shotcut/Kdenlive 时间线文件；label/action 分离的切割语义 | 5,225★，推送 2026-09-13，活跃 | Unlicense（公有领域） | ⭐⭐⭐ 直接当 zhiying 的"素材粗剪 skill"用，其 NLE 导出器是 OTIO 之外最实用的中间格式生成器 |
| MoneyPrinterTurbo | [harry0703/MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | 一键短视频生成流水线：LLM 脚本→TTS→素材→字幕→FFmpeg 合成；WebUI/API/CLI/Agent skill 四入口 | 124,023★，推送 2026-09-16 | MIT | ⭐⭐ 参考其"pipeline 清单 + skill 文档给 agent"的做法（与 zhiying 理念同构）；不碰 NLE |
| ShortGPT | [RayVentura/ShortGPT](https://github.com/RayVentura/ShortGPT) | AI 视频自动化框架：EditingEngine 用 EML（Editing Markup Language，LLM 友好的 JSON 编辑语言）+ MoviePy 渲染 | 7,950★，但最近推送 2025-02-10（**已停滞约一年半**） | MIT | ⭐⭐ "给 LLM 的编辑中间语言"设计值得借鉴；引擎本身基于 MoviePy 较粗糙 |
| FilmAgent / VideoClaw | [HITsz-TMG/VideoClaw](https://github.com/HITsz-TMG/VideoClaw)（原 FilmAgent，[项目页](https://filmagent.github.io/)，[论文](https://arxiv.org/abs/2501.12909)） | LLM 多智能体（导演/编剧/演员/摄影）在 Unity 3D 虚拟场景中端到端拍片 | 1,798★，推送 2026-08-26 | MIT | ⭐ 多 agent 剧组协作与迭代修订机制可参考；产物是 3D 虚拟拍摄而非剪辑 |
| Anim-Director | [HITsz-TMG/Anim-Director](https://github.com/HITsz-TMG/Anim-Director)（[论文](https://arxiv.org/abs/2408.09787)） | LMM 驱动的可控动画视频生成 agent（SIGGRAPH Asia 2024） | 256★，推送 2026-01-07 | 未标注（未核实） | ⭐ 生成侧参考 |
| Revideo | [midrender/revideo](https://github.com/midrender/revideo) | TypeScript 代码式视频渲染引擎（Remotion/Motion Canvas 同类），零依赖核心、headless render API、明确宣传"Claude/Codex 可从 prompt 生成 scene" | 4,046★，推送 2026-07-15 | MIT | ⭐⭐ 与 Remotion 同类但更轻、agent 友好度更高；可作为现有渲染层的备选，但不解决"操控专业 NLE" |
| LAVE | [项目页](https://www.dgp.toronto.edu/~bryanw/lave/) / [ACM 论文](https://dlnext.acm.org/doi/fullHtml/10.1145/3640543.3645143) | 学术工作（UIST 2024）：LLM agent 辅助视频编辑——素材规划（footage organization）+ 检索 + 剪辑操作，概念验证 | 论文，非活跃软件 | — | ⭐⭐ 其"LLM 规划 → 机器执行编辑原语"的交互设计与 zhiying 的 agent-skill 模型直接同构，值得精读 |
| Time-Stamper | 未找到可靠的对应开源项目（GitHub 搜索仅有同名小工具如 [madebygps/timestamper](https://github.com/madebygps/timestamper-python)，与 LLM 时间戳剪辑无关） | **未核实/可能不存在** | — | — | — |
| awesome-ai-media | [JuneYaooo/awesome-ai-media](https://github.com/JuneYaooo/awesome-ai-media) | 150+ AI 视频/创作工具清单，可用于持续跟踪 | 存在，星数未核实 | — | 目录索引 |

### 2.3 通用 MCP 工具生态

| 名称 | 链接 | 是什么 | 状态 | 备注 |
|---|---|---|---|---|
| ffmpeg-mcp | [PedroMarianoAlmeida/ffmpeg-mcp](https://github.com/PedroMarianoAlmeida/ffmpeg-mcp) | FFmpeg 工具集 MCP server（裁剪、拼接、转码、滤镜等） | 2★，推送 2025-12-19，基本无人用 | ⭐ 价值有限：coding agent 本就能直接跑 ffmpeg CLI，MCP 包装收益小 |
| CapCutAPI 的 MCP 模式 | 见 2.1 | 11 个剪辑工具走 MCP | 活跃 | 更实用的"MCP 化剪辑"实例 |
| ComfyUI | [comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI) | 节点图 diffusion GUI/API/backend | 133,400★，极活跃，GPL-3.0 | **不做剪辑**：它是生成（文生图/文生视频/局部重绘）工作流，无 NLE 时间线模型。可作为 zhiying 的"素材生成 skill"后端，但 GPL-3.0 对集成方式有传染性约束（服务进程隔离调用则无碍，需法务确认） |

### 2.4 时间线交换格式

| 名称 | 链接 | 是什么 | 状态 | 对我们的价值 |
|---|---|---|---|---|
| OpenTimelineIO (OTIO) | [AcademySoftwareFoundation/OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO)、[opentimeline.io](http://opentimeline.io/) | ASWF 旗下编辑信息交换格式与 API：C++ 核心 + `opentime` 有理数时间库 + Python 绑定；适配器插件支持 FCPXML、AAF、CMX 3600 EDL 等（v0.16 后插件移入 [OpenTimelineIO 组织](https://github.com/OpenTimelineIO) 与 `OpenTimelineIO-Plugins` 包） | 1,981★，推送 2026-09-13，成熟稳定（README 自述 API 已视为 stable、行业广泛部署）；Apache-2.0 | ⭐⭐⭐ **agent 生成时间线给专业软件的最佳中间表示**：Timeline/Stack/Track/Gap/Transition 对象模型即"编辑决策"的干净抽象 |
| EDL (CMX 3600) | 历史格式，OTIO/AEM/Resolve 均支持读写 | 极简 cut 清单 | — | 只表达剪切+简单 dissolve，作为兜底导出 |
| FCPXML | Apple 格式，fcp-mcp / OTIO 适配器支持 | FCP 的项目交换 XML | — | fcp-mcp 证明了程序化生成 FCPXML 可行（需 DTD gate + 一次性导入验证） |
| Resolve 的 interchange | Resolve 原生导入导出 FCPXML/FCP7 XML/AAF/EDL；davinci-resolve-mcp 的 timeline 模块含 "checked interchange exports/imports" | — | — | MCP 已封装好 |

---

## 3. 重点项目详解（基于 README 精读）

### 3.1 samuelgursky/davinci-resolve-mcp — agent 驾驶 Resolve 的标杆

- **架构**：三层。(1) Python MCP server（stdio）通过 Resolve 官方 Scripting API 实控运行中的 Resolve——compound 模式 34 个工具（把相关操作分组以省 context）/ granular 模式 341 个工具（一 API 方法一工具）；(2) Node 实现的 `davinci-resolve-advanced-mcp`：**不启动 Resolve** 直接读写 `.drp/.drt/.drx` 工程与调色文件、DB 级 YAML→SQLite pipeline，可跑在云端；(3) 本地浏览器控制面板。另有免费版 bridge：在 Resolve 内部跑一个小脚本把 `resolve` 对象经认证 loopback 转发出来。
- **能力**：宣称覆盖 Resolve Scripting API 336/336 方法、98.5% 实机测试通过（自述，未独立核实）；剪辑/媒体池/时间线/conform、markers 评审、调色（CDL/DRX/LUT/Gallery）、Fusion 图、Fairlight 音频、渲染队列、甚至 DCTL/Fuse 扩展安装管理；媒体分析可选挂 ffmpeg/whisper/librosa(CLAP/beat)/open_clip 做转写、视觉分析、音乐节拍。
- **局限（README 自己明确列出，工程文化极好）**：不判断剪辑好坏、不选最佳 take（只按流利度排）、无节拍检测、定位是"助理剪辑的第一遍组装"；源媒体不可变原则；免费版 bridge 依赖 Workspace▸Scripts 菜单，Blackmagic 随时可能封。
- **对我们的意义**：这份 README 几乎就是"如何为 NLE 写 agent 工具层"的教科书——工具分组控制 context、破坏性操作 plan→review→confirm、能力边界诚实文档化。

### 3.2 WyattBlue/auto-editor — 最实用的素材分析粗剪层

- **架构**：Nim 编写的 CLI；`--edit` 参数用小型声明语言组合检测方法（audio/motion，可 or/and、按 stream、dB 阈值），每个时间点打 0-255 的 label，`--when` 决定每个 label 的动作（cut/keep/speed）。
- **能力**：静音/无运动检测切割、变速、多轨不同策略；关键是 **`--export premiere|resolve|final-cut-pro|shotcut|kdenlive|clip-sequence` 直接产出各 NLE 的时间线文件**。
- **局限**：只做"第一遍"客观切割，无语义理解；导出的是剪切决策，不含特效/调色。
- **价值**：作为 zhiying 的一个 skill 立刻可用（Public Domain，无许可负担）；它证明了"分析层输出 → NLE 时间线"管线的真实需求。

### 3.3 leancoderkavy/premiere-pro-mcp — Premiere 自动化的现实与困境

- **架构**：Node MCP server ↔ 文件桥（写 .jsx 到共享 temp 目录，CEP 面板轮询执行、回写 JSON）↔ Premiere 内 CEP 面板跑 ExtendScript(ES3)；大量能力依赖**未公开文档的 QE DOM**（`app.enableQE()`）实现效果应用、ripple/roll/slip 编辑、变速；另有 Premiere 25.6+ 的 UXP panel 作为预览后端（95 个能力门控工具）。369 个核心工具 + 14 个 MCP resources（项目/时间线/效果目录的只读快照，带 revision token 防脏读）。
- **能力**：导入、时间线剪辑、特效/转场、关键帧、字幕、MOGRT（经独立 AE 桥）、导出、静音检测（ffmpeg）、平台交付规划。
- **局限**：ExtendScript 是 ES3 化石、QE DOM 无文档且随版本漂移、CEP 是被 Adobe 淘汰中的技术栈（UXP 迁移中）；安装链（npm + .zxp + debug mode 注册表）对终端用户不友好。
- **结论**：可作能力参考与代码考古对象，但把 Premiere 作为主力被控目标成本高。

### 3.4 dreliq9/fcp-mcp — FCPXML 的事务化工程

- **架构**：纯 Python MCP server；核心是 FCPXML 的解析/生成/校验/原子提交（defusedxml 防注入、有理数时间码 `720/24s` 全程无浮点漂移、prepare→diff→hash 确认→commit 的工作流引擎），AppleScript 桥做有限实控（菜单/快捷键/播放/Share），ffprobe 做媒体分析；可导出 Resolve XML / FCP7 XMEML / EDL。
- **局限**：单人项目（9★）、macOS only、自述"非完整 Apple schema 校验"，重要产物需用一次性工程导入验证；live control 需显式开启且新版 FCP 脚本面持续收窄。
- **价值**：**"文件级时间线操作 + 事务提交 + QC 报告（闪帧/gap/pacing）"这套模式**完全可以抽出来用在我们的 OTIO 层上。

### 3.5 sun-guannan/CapCutAPI — 剪映的社区 API

- **架构**：Python HTTP server（9 个端点：create_draft/add_video/add_audio/add_image/add_text/add_subtitle/add_effect/add_sticker/save_draft）+ MCP server（11 工具）；产出 `dfd_` 草稿目录，复制进剪映草稿文件夹即可打开继续编辑。
- **能力**：多轨、转场、特效、关键帧（scale/alpha/位置）、SRT 字幕、样式文本。
- **局限**：逆向草稿格式，剪映版本升级可能破坏兼容；作者明言"MCP 剪辑 Agent、web 端、云渲染"三块未开源。
- **价值**：如果 zhiying 目标用户在剪映生态（国内短视频），这是接入"用户熟悉的编辑器"的最短路径。

### 3.6 AcademySoftwareFoundation/OpenTimelineIO — 时间线中间表示

- **架构**：C++ 核心（数据模型 + `opentime` 有理数时间库）+ Python 绑定 + 插件系统（adapters / media linkers / hook scripts / schemadefs）。适配器生态覆盖 FCPXML、AAF、CMX 3600 EDL 等；v0.16 起核心包只含 `.otio/.otioz/.otiod`，其余在 `OpenTimelineIO-Plugins`。
- **能力/地位**：ASWF 治理、影视行业广泛部署、"natively supported in most NLE"（Resolve 原生支持 OTIO 导入导出）。
- **局限**：只表达编辑决策（cut 顺序、长度、媒体引用），不含特效参数/调色细节；特效、合成需靠各 NLE 自己的扩展。
- **对 zhiying**：把内部 pipeline 清单的目标态定义为 OTIO 对象树，agent 产出 `.otio`，经适配器落到任意 NLE——这是"中间表示层"的最优解。

### 3.7 harry0703/MoneyPrinterTurbo / RayVentura/ShortGPT（合并简评）

两者都是"topic→成片"的模板流水线：LLM 生成脚本 → TTS 配音 → Pexels/生成模型配素材 → MoviePy/FFmpeg 拼装 → 字幕。MoneyPrinterTurbo 极活跃（124k★、日更、提供 API/CLI/批量清单/Agent Skill 文档），工程完成度高；ShortGPT 的亮点是 **Editing Markup Language**——为 LLM 设计的 JSON 编辑原语集，与我们的 skills 概念同源，但项目已停滞（最后推送 2025-02）。两者都不提供时间线级编辑能力，定位与 zhiying 的"驾驶 NLE"目标正交，主要价值在 pipeline 组织与 skill 化交付的参考。

---

## 4. 给 zhiying 的采纳建议（分层路线）

### 短期（0-2 月）：工具层直接吸收，Remotion 保留为渲染兜底

1. **把 auto-editor 封装为 zhiying 的一个 skill**（`--export resolve` 输出时间线）。理由：零许可成本（Unlicense）、立即获得"素材粗剪 + 多 NLE 时间线输出"能力，且验证我们 agent 管线与外部 CLI 的接缝。风险：无。
2. **直接试用/二次封装 davinci-resolve-mcp**，同时给 agent 写一个直连 Resolve Scripting API 的薄 Python skill（项目/媒体池/时间线/渲染四类原语即可）。理由：Resolve 是唯一"官方 API + 免费可用(Linux) + 专业能力完整"的 NLE，Studio 版外部脚本无障碍。风险：需要一台常驻 Resolve 的机器（headless 不可行，Resolve 必须跑 GUI；免费版需 bridge 且可能被封——生产环境建议买 Studio）。
3. 借鉴 davinci-resolve-mcp 的**工具分组与 plan→confirm 安全模型**设计我们自己的 NLE skill 协议。

### 中期（2-6 月）：OTIO 作为时间线中间表示，"一次生成、处处可剪"

4. **定义 zhiying 的 timeline IR = OTIO**：agent 的 pipeline 清单产出 `Timeline/Stack/Track/Clip/Gap/Transition` 对象树（可自定义 SchemaDef 扩展特效意图），经 adapters 导出 FCPXML / FCP7 XML / EDL / Resolve 原生。理由：ASWF 治理、行业事实标准、Python 绑定成熟；从此 Remotion 只是"渲染 OTIO 的一个后端"，Resolve/Premiere/剪映是并列后端。风险：OTIO 不携带特效/调色参数——需要在自定义 schema 里存"意图"，落到各 NLE 时由对应 skill 翻译（davinci-resolve-mcp 的 Fusion/调色 API、CapCutAPI 的 effect id 表）。
5. 抽取 fcp-mcp 的**事务化提交 + QC（闪帧/gap/pacing/时长校验）**代码模式，实现"agent 生成时间线 → 自动 QC → 提交"的 gate，对齐我们已有的 quality-gate 流程。
6. 若目标用户在剪映生态：接入 CapCutAPI 作为中国区后端（风险：草稿格式随版本漂移，需 pin 剪映版本 + 兼容测试）。

### 长期（6 月+）：MCP 化，让 agent 直接驾驶多种 NLE

7. **把 zhiying 的 NLE skills 发布为自研 MCP server**（tool 面：inspect / plan / apply-diff / render / QC），后端按目标切换：Resolve Scripting API（首选）、OTIO 文件交换（兜底，覆盖所有 NLE）、CapCutAPI（国内）。吸收 davinci-resolve-mcp 的 compound-tool 分组（控 context）与 capability profile（控破坏性）。理由：MCP 已是 agent-工具事实协议，上述三个生态全部有 MCP 先例可抄。风险：各 NLE 版本漂移需要持续兼容矩阵（davinci-resolve-mcp 的 api-coverage/live-test 文档模式值得照抄为 CI）。
8. 明确**不做的**：Premiere 深度实控（CEP/QE DOM 维护成本高，用 OTIO→FCP7 XML 文件交换覆盖即可）；自研时间线格式（OTIO 已赢）；ComfyUI 式生成工作流并入核心（保留为可选素材生成 skill，注意 GPL 隔离）。

### 风险总表

| 风险 | 影响环节 | 缓解 |
|---|---|---|
| Resolve 免费版外部脚本被 gate / bridge 被封 | 短期 | 购买 Studio（一次性付费）；OTIO 文件交换兜底 |
| 剪映草稿格式逆向漂移 | 中期 | pin 版本；订阅 CapCutAPI 上游更新 |
| OTIO 不表达特效/调色 | 中期 | 自定义 SchemaDef 存意图 + 每后端翻译器 |
| 单人维护项目（fcp-mcp 等）弃坑 | 中期 | 只吸收模式，不依赖运行时 |
| 各 NLE 版本升级破坏 API | 长期 | 兼容矩阵 + live-test CI（学 davinci-resolve-mcp） |

---

## 5. 未核实论断清单

- davinci-resolve-mcp 自述的 "100% API 覆盖 / 98.5% live-tested"：仅来自其 README/docs，未独立验证。
- premiere-pro-mcp / fcp-mcp / CapCutAPI 的实际工具可用性与稳定性：仅读 README，未实机测试。
- auto-cut-agent、fcpxml-mcp-server、capcut-mate、awesome-ai-media：确认存在，星数/维护状态未核实。
- Olive 编辑器的脚本 API 现状：未核实。
- "Time-Stamper" 项目：**未找到任何可靠对应物，视为未核实/可能不存在**。
- Anim-Director 的 license：仓库未标注，未核实。
- ComfyUI 与 GPL-3.0 的集成边界：仅依据 license 标注推断，未做法律结论。
- MoneyPrinterTurbo README 中大量赞助商内容（Kimi、火山引擎等）与项目能力的对应关系未逐一验证。

## 附：主要一手来源

- [WyattBlue/auto-editor README](https://github.com/WyattBlue/auto-editor) · [harry0703/MoneyPrinterTurbo README](https://github.com/harry0703/MoneyPrinterTurbo) · [RayVentura/ShortGPT README](https://github.com/RayVentura/ShortGPT)
- [samuelgursky/davinci-resolve-mcp README](https://github.com/samuelgursky/davinci-resolve-mcp) · [DaVinci Resolve Scripting API 文档（社区 wiki）](https://wiki.dvresolve.com/developer-docs/scripting-api)
- [leancoderkavy/premiere-pro-mcp README](https://github.com/leancoderkavy/premiere-pro-mcp) · [rafcopy/auto-cut-agent](https://github.com/rafcopy/auto-cut-agent)
- [dreliq9/fcp-mcp README](https://github.com/dreliq9/fcp-mcp) · [DareDev256/fcpxml-mcp-server](https://github.com/DareDev256/fcpxml-mcp-server)
- [sun-guannan/CapCutAPI 中文 README](https://github.com/sun-guannan/CapCutAPI) · [Hommy-master/capcut-mate](https://github.com/Hommy-master/capcut-mate)
- [AcademySoftwareFoundation/OpenTimelineIO README](https://github.com/AcademySoftwareFoundation/OpenTimelineIO) · [OpenShot/libopenshot](https://github.com/OpenShot/libopenshot) · [mltframework/mlt](https://github.com/mltframework/mlt) · [Kdenlive 邮件列表：无脚本 API](https://mail.kde.org/pipermail/kdenlive/2019-September/010628.html)
- [midrender/revideo README](https://github.com/midrender/revideo) · [HITsz-TMG/VideoClaw (原 FilmAgent)](https://github.com/HITsz-TMG/VideoClaw) · [FilmAgent 项目页](https://filmagent.github.io/) · [HITsz-TMG/Anim-Director](https://github.com/HITsz-TMG/Anim-Director)
- [LAVE 项目页](https://www.dgp.toronto.edu/~bryanw/lave/) / [ACM DL](https://dlnext.acm.org/doi/fullHtml/10.1145/3640543.3645143)
- [PedroMarianoAlmeida/ffmpeg-mcp](https://github.com/PedroMarianoAlmeida/ffmpeg-mcp) · [comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI)
