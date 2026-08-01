# muteClip

## Purpose
Mute or unmute clips. Muted clips are silent during export but remain on the timeline.
Operates on a single clip, an entire track, or all audio clips.

## When to use
- User says "静音BGM" / "把背景音乐关掉" / "把这段声音去掉"
- User says "取消静音" / "恢复声音" / "打开原声"
- User wants to preview with/without music

## Intent tags
mute unmute silence quiet track audio bgm sfx 静音 关声音 取消静音 恢复声音

## Parameters
- `muted` (required): true to mute, false to unmute.
- `clipId` (optional): target one specific clip.
- `trackIndex` (optional): apply to all clips on a track (0=video, 1=BGM, 2=SFX).
- If neither is given, applies to all audio clips.

## Example calls
muteClip({ muted: true, trackIndex: 1 })           → mute entire BGM track
muteClip({ muted: false, trackIndex: 1 })           → unmute BGM track
muteClip({ muted: true, clipId: "xyz789" })         → mute one clip
muteClip({ muted: true, trackIndex: 0 })            → mute original game audio
