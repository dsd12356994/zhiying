# setVolume

## Purpose
Set the playback volume of one or more clips. Applies to any clip type (video, audio, text).
Volume 0 = silent, 1 = original, max 2 (double loudness).

## When to use
- User says "把BGM音量调到30%" / "音乐太大声了" / "降低背景音乐"
- User says "游戏声音开大一点" / "原声音量80%"
- Balancing game audio vs BGM after applyTemplate

## Intent tags
volume audio bgm music loud quiet balance mix game sound 音量 音乐 游戏声音 背景音乐

## Parameters
- `volume` (required): 0–2 float. Example: 0.3 for 30%, 1.0 for original.
- `clipId` (optional): target a specific clip by id.
- `trackIndex` (optional): apply to ALL clips on a track (0=video, 1=BGM, 2=SFX).
- If neither clipId nor trackIndex is given, applies to all audio clips on track 1 (BGM).

## Example calls
setVolume({ volume: 0.3 })                         → BGM track to 30%
setVolume({ volume: 0.8, trackIndex: 0 })          → video track audio to 80%
setVolume({ volume: 1.5, clipId: "abc123" })        → boost one specific clip

## Typical workflow after applyTemplate
1. applyTemplate sets gameSoundRatio and bgmRatio automatically.
2. User may fine-tune: setVolume({ volume: 0.5 }) to adjust BGM further.
