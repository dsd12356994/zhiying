export async function detectBeats(audioBuffer: AudioBuffer): Promise<number[]> {
  const channel = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const windowSize = Math.max(256, Math.floor(sampleRate * 0.05)); // 50ms
  const energies: number[] = [];

  for (let i = 0; i < channel.length; i += windowSize) {
    let sum = 0;
    const end = Math.min(channel.length, i + windowSize);
    for (let j = i; j < end; j++) {
      const v = channel[j] ?? 0;
      sum += v * v;
    }
    energies.push(Math.sqrt(sum / Math.max(1, end - i)));
  }

  if (!energies.length) return [];
  const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
  const threshold = mean * 1.45;
  const minGapSec = 0.22;
  const minGapWindows = Math.max(1, Math.floor(minGapSec / (windowSize / sampleRate)));

  const beats: number[] = [];
  let lastIndex = -minGapWindows;
  for (let i = 1; i < energies.length - 1; i++) {
    const e = energies[i];
    if (
      e > threshold &&
      e > (energies[i - 1] ?? 0) &&
      e >= (energies[i + 1] ?? 0) &&
      i - lastIndex >= minGapWindows
    ) {
      beats.push((i * windowSize) / sampleRate);
      lastIndex = i;
    }
  }
  return beats;
}
