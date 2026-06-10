# addKeyframe

**描述**：为片段添加关键帧动画点。

**支持属性**：
- `x` / `y`（位移）
- `scale`（缩放）
- `rotation`（旋转）
- `opacity`（透明度）

**参数**：
- `clipId` / `clipIndex`：目标片段
- `property`：属性名
- `time`：相对片段起点时间（秒）
- `value`：属性值
- `easing`：`linear` / `easeInOut` / `bounce`

**示例**：
- `addKeyframe({ clipIndex: 1, property: "scale", time: 2, value: 1.5 })`
- `addKeyframe({ property: "opacity", time: 0, value: 0 })`
