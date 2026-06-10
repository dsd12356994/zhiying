# detectBeats

**描述**：分析音频片段并在时间轴生成节拍点。

**使用场景**：
- “分析这首背景音乐的节拍”
- “先做节拍检测”

**参数**：
- `clipId` (string, 可选)：目标音频片段 ID，不传则自动选择当前或第一个音频片段。

**示例**：
- `detectBeats({})`
- `detectBeats({ clipId: "clip-xxx" })`
