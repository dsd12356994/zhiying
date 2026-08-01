/**
 * Speech Synthesis Tool — Edge TTS integration for text-to-speech.
 * Uses the free Microsoft Edge TTS API via a lightweight proxy approach.
 */

import type { Tool } from "./toolRegistry";

const EDGE_TTS_URL = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud";

const VOICE_OPTIONS: Record<string, { name: string; locale: string; gender: string }> = {
  xiaoxiao: { name: "zh-CN-XiaoxiaoNeural", locale: "zh-CN", gender: "Female" },
  yunxi:   { name: "zh-CN-YunxiNeural",   locale: "zh-CN", gender: "Male" },
  xiaoyi:  { name: "zh-CN-XiaoyiNeural",  locale: "zh-CN", gender: "Female" },
  yunjian: { name: "zh-CN-YunjianNeural", locale: "zh-CN", gender: "Male" },
  yunyang: { name: "zh-CN-YunyangNeural", locale: "zh-CN", gender: "Male" },
};

function buildSsml(text: string, voiceId: string, speed: number): string {
  const voice = VOICE_OPTIONS[voiceId] ?? VOICE_OPTIONS.xiaoxiao!;
  const rate = speed === 1 ? "" : ` rate="${speed > 1 ? "+" : ""}${Math.round((speed - 1) * 100)}%"`;
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="${voice.locale}">` +
    `<voice name="${voice.name}"><prosody${rate} pitch="+0Hz">${text}</prosody></voice></speak>`
  );
}

async function synthesizeEdgeTts(text: string, voiceId = "xiaoxiao", speed = 1.0): Promise<Blob> {
  // Use the free Edge TTS readaloud endpoint (works from browser with no auth)
  const ssml = buildSsml(text, voiceId, speed);

  const res = await fetch(
    `${EDGE_TTS_URL}?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: ssml,
    }
  );

  if (!res.ok) {
    throw new Error(`Edge TTS 请求失败: ${res.status}`);
  }

  return res.blob();
}

export const synthesizeSpeechTool: Tool = {
  name: "synthesizeSpeech",
  description:
    "将脚本文字转换为自然语音（中文）。使用微软 Edge 免费 TTS，支持多种音色。" +
    "生成后可传给 generateAvatar 制作数字人口播视频。" +
    "Use when user wants to generate voice-over audio from a script.",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "要转换为语音的文本（脚本内容）",
      },
      voice: {
        type: "string",
        enum: ["xiaoxiao", "yunxi", "xiaoyi", "yunjian", "yunyang"],
        description: "语音角色。xiaoxiao=温柔女声(默认), yunxi=专业男声, xiaoyi=活泼女声, yunjian=沉稳男声, yunyang=新闻男声",
        default: "xiaoxiao",
      },
      speed: {
        type: "number",
        description: "语速倍率（0.5-2.0，默认1.0=正常）",
        default: 1.0,
      },
    },
    required: ["text"],
    additionalProperties: false,
  },
  async execute(params) {
    const text = typeof params.text === "string" ? params.text.trim() : "";
    if (!text) return { ok: false, errorCode: "BAD_PARAMS", message: "synthesizeSpeech 需要 text 参数。" };

    const voice = (typeof params.voice === "string" && VOICE_OPTIONS[params.voice]) ? params.voice : "xiaoxiao";
    const speed = typeof params.speed === "number" && params.speed >= 0.5 && params.speed <= 2.0
      ? params.speed : 1.0;

    try {
      const audioBlob = await synthesizeEdgeTts(text, voice, speed);
      const audioUrl = URL.createObjectURL(audioBlob);
      const durationEstimate = text.length / 4.5; // rough estimate: ~4.5 chars/sec for Chinese

      return {
        ok: true,
        message: `已生成语音（音色: ${VOICE_OPTIONS[voice]?.name}，约 ${durationEstimate.toFixed(0)} 秒）。`,
        data: {
          audioUrl,
          audioBlob,
          durationEstimate: Math.ceil(durationEstimate),
          voice: VOICE_OPTIONS[voice]?.name,
          textLength: text.length,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "TTS 失败";
      return { ok: false, errorCode: "TTS_FAILED", message: `语音合成失败：${msg}` };
    }
  },
};
