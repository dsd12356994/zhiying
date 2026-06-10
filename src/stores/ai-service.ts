/**
 * DeepSeek API 集成 + AI 命令解析
 * 让用户可以用自然语言操作智映编辑器
 */

const API_URL = "https://api.deepseek.com/v1/chat/completions";
// Vite 仅暴露 VITE_* 前缀的环境变量到客户端
const API_KEY: string = import.meta.env.VITE_DEEPSEEK_API_KEY || "";

export interface AICommand {
  action: "trim" | "split" | "delete" | "speed" | "addText" | "export" | "undo" | "redo" | "unknown";
  params: Record<string, string | number>;
}

/** 调用 DeepSeek 解析用户指令为结构化命令 */
export async function parseUserCommand(userInput: string): Promise<{
  reply: string;
  command: AICommand | null;
}> {
  if (!API_KEY) {
    return {
      reply: "⚠️ 未配置 API Key。请在项目根目录创建 .env 文件，添加 VITE_DEEPSEEK_API_KEY=your_key_here",
      command: null,
    };
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `你是智映视频编辑器的 AI 助手。你根据用户的自然语言指令，返回 JSON 格式的结构化命令。

可执行的命令类型：
1. trim: 裁剪视频
   {"action":"trim","params":{"start":2,"end":5}}
   "裁剪到3-5秒" → 保留3到5秒这段
   "裁剪到5秒" → 保留前5秒
   "裁剪掉前2秒" → 去掉前2秒

2. split: 分割
   {"action":"split","params":{"time":3}}  
   "在3秒处分割" → 在3秒位置分割

3. delete: 删除
   {"action":"delete","params":{"index":2}}
    "删除第二段" → 删除第2个片段
    "删除选中" → 删除当前选中

4. speed: 变速
   {"action":"speed","params":{"rate":2}}
   "加速到2倍" → 速度设为2x
   "放慢到0.5倍" → 速度设为0.5x

5. addText: 添加文字
   {"action":"addText","params":{"text":"你好世界","duration":3}}
   "添加字幕 你好世界" → 创建一个持续3秒的文字

6. export: 导出
   {"action":"export","params":{}}

**重要规则：**
- 如果用户要求无法用上述命令实现，返回 {"action":"unknown","params":{"reason":"原因"}}
- 用中文回复，给出执行确认或解释
- 必须返回 JSON，格式：{"reply":"你的回复","command":命令对象或null}
- 如果没有对应命令，command返回null

示例：
用户："裁剪到3秒"
回复：{"reply":"✅ 已裁剪到3秒","command":{"action":"trim","params":{"end":3}}}

用户："在5秒处分割"
回复：{"reply":"✅ 已在5秒处分割","command":{"action":"split","params":{"time":5}}}

用户："你好"
回复：{"reply":"你好！我是智映 AI 助手，你可以用自然语言指挥我剪辑视频。试试说「裁剪到3秒」或「删除第二段」","command":null}`,
          },
          { role: "user", content: userInput },
        ],
        temperature: 0.1,
        max_tokens: 512,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        reply: parsed.reply || content,
        command: parsed.command || null,
      };
    }

    return { reply: content, command: null };
  } catch (e) {
    console.error("AI service error:", e);
    return {
      reply: "⚠️ AI 服务暂时不可用，请检查网络或稍后重试。",
      command: null,
    };
  }
}

/** 本地解析（离线备用） */
export function parseLocalCommand(input: string): { reply: string; command: AICommand | null } {
  const lower = input.toLowerCase().trim();

  // "裁剪到X秒" / "trim to X seconds"
  const trimMatch = lower.match(/裁剪到?(\d+(?:\.\d+)?)\s*秒/);
  if (trimMatch) {
    return {
      reply: `✅ 已裁剪到 ${trimMatch[1]} 秒`,
      command: { action: "trim", params: { end: parseFloat(trimMatch[1]) } },
    };
  }

  // "删除第X段" / "delete clip X"
  const delMatch = lower.match(/删除第(\d+)段/);
  if (delMatch) {
    return {
      reply: `✅ 已删除第 ${delMatch[1]} 段素材`,
      command: { action: "delete", params: { index: parseInt(delMatch[1]) } },
    };
  }

  // "在X秒处分割" / "split at X"
  const splitMatch = lower.match(/在?(\d+(?:\.\d+)?)\s*秒处?分割/);
  if (splitMatch) {
    return {
      reply: `✅ 已在 ${splitMatch[1]} 秒处分割`,
      command: { action: "split", params: { time: parseFloat(splitMatch[1]) } },
    };
  }

  // "加速到X倍"
  const speedMatch = lower.match(/加速到?(\d+(?:\.\d+)?)\s*倍/);
  if (speedMatch) {
    return {
      reply: `✅ 已加速到 ${speedMatch[1]} 倍`,
      command: { action: "speed", params: { rate: parseFloat(speedMatch[1]) } },
    };
  }

  // "添加字幕/文字"
  const textMatch = lower.match(/添加(?:字幕|文字)[：:]?\s*(.+)/);
  if (textMatch) {
    return {
      reply: `✅ 已添加文字「${textMatch[1]}」`,
      command: { action: "addText", params: { text: textMatch[1], duration: 3 } },
    };
  }

  // "撤销" / "undo"
  if (lower.includes("撤销") || lower === "undo") {
    return { reply: "✅ 已撤销", command: { action: "undo", params: {} } };
  }
  // "重做" / "redo"
  if (lower.includes("重做") || lower === "redo") {
    return { reply: "✅ 已重做", command: { action: "redo", params: {} } };
  }
  // "裁剪掉前N秒"
  const trimFrontMatch = lower.match(/裁剪掉前(\d+(?:\.\d+)?)\s*秒/);
  if (trimFrontMatch) {
    return {
      reply: "✅ 已裁剪掉前 " + trimFrontMatch[1] + " 秒",
      command: { action: "trim", params: { edge: "start", delta: parseFloat(trimFrontMatch[1]) } },
    };
  }
  // "导出"
  if (lower.includes("导出") || lower.includes("export")) {
    return {
      reply: "✅ 正在准备导出…",
      command: { action: "export", params: {} },
    };
  }

  return {
    reply: "抱歉，我没理解你想做什么。试试：\n- 「裁剪到 5 秒」\n- 「删除第二段」\n- 「在 3 秒处分割」\n- 「添加字幕 你好」\n- 「导出视频」",
    command: null,
  };
}
