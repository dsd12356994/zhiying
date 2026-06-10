# listTransitions

**描述**：列出当前时间轴所有转场配置。

**使用场景**：
- 用户询问“当前有哪些转场”
- AI 在添加新转场前做冲突检查

**参数**：
- 无

**返回**：
- `transitions[]`：每项包含 `id/fromClipId/toClipId/type/duration`
