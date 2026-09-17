# Skill: Motion-graphics overlay（大白话 → 动效 → 叠进时间线）

**产品形态**（用户 2026-09-16 指定的目标效果）：你说"把这句话变成看得见的"
→ agent 生成**带透明通道的动效片段** → 直接叠在你的素材上（剪映叠加轨），
或作为独立文件拖进任何 NLE。剪辑本身不动；agent 只负责"让信息被看到，
而不只是被听到"。

**能力链**（全部 live-verified 2026-09-16）：

```
大白话 brief
  → scene：composer 的 stat_card（或任何 cut 类型）+ transparent:true
  → 渲染：npx remotion render ... --codec=prores --prores-profile=4444
          --image-format=png --pixel-format=yuva444p10le   ← alpha 就靠这三件套
  → 落地A：jianying_draft(overlays=[...])  ← 剪映第二视频轨，alpha 原生合成
  → 落地B：独立 .mov 文件，手动拖进任意 NLE
```

## 现成的动效类型

- `stat_card` — 数据动效卡（"73% / 胜率"型）：数字计数滚入 + 弹性入场 +
  标签滑入 + 末尾 6 帧淡出（避免在 NLE 里硬切）。**永不画底色**，专为
  overlay 设计。`position` 五个方位。
- 其余 cut 类型（`text_card`/`particle_burst`/…）画自己的底色，适合全屏
  场景不适合 overlay——除非你的场景设计本身不铺底。

## 怎么调（agent 实操）

1. **brief**：用户说"游戏视频里讲到某把枪 73% 胜率，做出来"。提炼：
   value="73%"、label="胜率 WIN RATE"、accent 色、出现时机（哪句话）、
   停留时长（2-4s）、画布尺寸 = **用户素材的尺寸**（竖屏 720×1280 等）。
2. **渲染**：写 props JSON（transparent:true + stat_card cut），在
   `composer/` 跑：
   ```powershell
   npx remotion render src/index.tsx CinematicTrailer out.mov `
     --props=props.json --codec=prores --prores-profile=4444 `
     --image-format=png --pixel-format=yuva444p10le
   ```
3. **验证 alpha**（必须做，别信"渲染成功"）：解一帧查 alpha：
   `ffprobe` pix_fmt 应为 `yuva444p12le`；解码出的 PNG 应为 RGBA 且
   角落 alpha=0、动效区域 alpha>0。
4. **落地**：剪映用户 → `jianying_draft(overlays=[{path, start, duration}])`
   （叠加轨自动命名为 "overlays"）；其他 NLE → 交付 .mov 文件。

## 已知坑（都踩过，别再踩）

- **webm+vp9 的 alpha 不可靠**（ffmpeg 默认解码丢 alpha 侧流）——统一用
  ProRes 4444 mov，剪映原生支持其 alpha。
- `--pixel-format=yuva444p10le` 必须显式给，否则 ProRes 默认不带 alpha。
- StatCard 的 flex 布局：flexDirection column 下 justifyContent 管纵向、
  alignItems 管横向（曾写反，bottom-left 渲染成了 top-right）。
- 叠加轨必须命名（同名类型轨道冲突），且 add_segment 需带
  `track="overlays"`。
- 剪映草稿画布要匹配主素材尺寸（竖屏素材配 720×1280，否则黑边）。

## 与视频里工作流的对照

| 视频里的说法 | 我们的对应 |
|---|---|
| "在 Claude 里问怎么装" | AGENT_GUIDE + skills（本文件） |
| "大白话描述想要的动效" | brief 阶段，agent 提炼成 cut props |
| "Claude 生成，你拖进时间线" | ProRes alpha .mov（落地B） |
| "剪辑本身不变" | 主轨 = 用户素材粗剪，动效只进叠加轨 |
| vidIQ 建议做什么动效 | 待接：可用 web_search/竞品分析替代（未实现） |
