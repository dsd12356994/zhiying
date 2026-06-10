# trimClip

描述：裁剪片段边缘到目标时间。

参数：
- clipId(string, 可选)
- edge(string, start|end)：裁左边还是右边
- time(number) 或 seconds(number)：目标秒数

常见场景：
- “把片段终点裁到 8 秒”
- “把起点挪到 2 秒”

注意：
- edge 默认 end。
- 超出有效范围会失败。
