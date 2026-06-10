# addText

**描述**：在时间轴上添加字幕文本片段。

**使用场景**：
- “在 5 秒到 10 秒添加字幕 Hello AI”
- “从 2 秒开始加一条字幕”

**参数**：
- `content` (string): 字幕文本
- `start` (number): 开始时间（秒）
- `end` (number): 结束时间（秒）
- `fontSize` (number, 可选): 字号
- `color` (string, 可选): 文字颜色

**示例**：
- `addText({ content: "你好世界", start: 5, end: 10, fontSize: 42, color: "#4da3ff" })`
