# getTimelineInfo

**描述**：获取当前时间轴上所有片段的结构化信息，包含 `id`、`start`、`end`、`track`。

**使用场景**：
- 用户询问“现在时间轴上有哪些片段？”
- 需要根据时间定位后续操作目标（例如先查询再删除/移动）

**参数**：
- 无参数

**返回**：
- `clips`: `[{ id, start, end, track }]`

**示例**：
- `getTimelineInfo({})`
