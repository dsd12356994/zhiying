# addTransition

**描述**：在两个片段之间添加转场效果。

**使用场景**：
- “在第一段和第二段之间加淡入淡出转场”
- “给这两个片段加 1 秒交叉溶解”

**参数**：
- `fromClipId` / `fromClipIndex`：起始片段
- `toClipId` / `toClipIndex`：目标片段
- `type`：`crossDissolve` / `slide` / `wipe` / `fade`
- `duration`：时长（0.1~2 秒）

**示例**：
- `addTransition({ fromClipIndex: 1, toClipIndex: 2, type: "fade", duration: 1 })`
- `addTransition({ type: "crossDissolve", duration: 1 })`（默认用当前片段和后继片段）
