# changeSpeed

**描述**：设置视频片段播放速度（0.1x ~ 10x）。

**使用场景**：
- “第三段快放 2 倍”
- “把当前片段放慢到 0.5 倍”

**参数**：
- `clipId` / `clipIndex`：目标片段
- `speed` (number)：速度倍率

**示例**：
- `changeSpeed({ clipIndex: 3, speed: 2 })`
- `changeSpeed({ speed: 0.5 })`
