# applyFilter

**描述**：给视频片段应用滤镜，并支持强度（0~1）调节。

**使用场景**：
- “给第一段加黑白滤镜”
- “把当前片段调成复古，强度 0.7”
- “把第二段做成电影感”

**参数**：
- `clipId` (string, 可选)：片段 ID
- `clipIndex` (number, 可选)：时间轴片段序号（从 1 开始）
- `filterName` (string)：滤镜名称（如 `noir`, `vintage`, `cinematic`）
- `intensity` (number, 可选)：强度，默认 `1`

**示例**：
- `applyFilter({ clipIndex: 1, filterName: "noir", intensity: 1 })`
- `applyFilter({ filterName: "vintage", intensity: 0.8 })`

**注意**：
- 仅视频片段支持滤镜；音频/文本片段会失败。
