/**
 * 音频波形提取工具
 * 使用 Web Audio API 解码音频并提取振幅数据
 */

/** 从 URL 提取波形数据（最多 samples 个采样点） */
export async function extractWaveform(url: string, samples = 400): Promise<number[]> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // 取第一个通道
    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;

    // 下采样到 samples 个点
    const step = Math.max(1, Math.floor(totalSamples / samples));
    const waveform: number[] = [];

    for (let i = 0; i < totalSamples && waveform.length < samples; i += step) {
      const end = Math.min(i + step, totalSamples);
      let max = 0;
      for (let j = i; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > max) max = abs;
      }
      waveform.push(max);
    }

    audioCtx.close();
    return waveform;
  } catch (e) {
    // 静默失败 — 非音频文件或解码失败时返回空数组
    console.debug("Waveform extraction skipped:", (e as Error).message);
    return [];
  }
}
