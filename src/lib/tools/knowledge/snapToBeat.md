# snapToBeat

**描述**：将片段起点吸附到最近节拍点。

**使用场景**：
- “让这段卡点”
- “把第二段对齐到节拍”

**参数**：
- `clipId` (string, 可选)：目标片段 ID，不传则使用当前选中片段。

**前置条件**：
- 需要先有节拍点（通常先调用 `detectBeats`）。

**示例**：
- `snapToBeat({})`
- `snapToBeat({ clipId: "clip-xxx" })`
