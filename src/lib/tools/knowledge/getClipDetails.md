# getClipDetails

**描述**：查询单个片段的完整信息（含速度、滤镜、关键帧、字幕样式）。

**使用场景**：
- AI 在修改前需要确认片段当前状态
- 用户询问“当前片段参数是什么”

**参数**：
- `clipId` / `clipIndex`（可选）

**返回**：
- `clip` 对象，包含 `start/end/track/speed/filter/keyframes/...`
