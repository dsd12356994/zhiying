# Avatar Knowledge Video Workflow

## When to apply
User wants to create an AI digital human knowledge-sharing video for insurance, finance, or immigration topics.

## Full workflow (execute phases in order)

### Phase 1 — Research
1. `searchWeb({query: "<user's topic>"})` — gather authoritative information
2. Extract key data points from search results

### Phase 2 — Script
3. `generateScript({topic, research: "<Phase 1 results>", tone})` — generate the spoken script
   - tone options: professional (专业), friendly (亲切), authoritative (权威), simple (简单)
   - Returns: title, script body, subtitle segments, hashtags
4. Optional: `previewScript({script})` to let user review

### Phase 3 — Speech
5. `synthesizeSpeech({text: "<script body>", voice: "xiaoxiao"})` — generate natural Chinese voice
   - Voice options: xiaoxiao (温柔女声), yunxi (专业男声), yunjian (沉稳男声)
   - Returns: audioUrl for next step

### Phase 4 — Avatar
6. `generateAvatar({photoUrl: "<user's uploaded photo>", audioUrl: "<from Phase 3>"})` — create talking-head video
   - Requires HeyGen API key in settings
   - Returns: videoUrl

### Phase 5 — Composition
7. `composeVideo({avatarVideoUrl, subtitles, branding})` — assemble final video
   - Adds subtitles, intro/outro, watermark, BGM
8. Optional: `applyFilter({filterName, intensity})` for color grading

### Phase 6 — Export
9. `exportVideo({filename: "<topic>-knowledge.mp4"})` — download vertical 9:16 video

## Pro tips
- Always search BEFORE generating script for accuracy
- Default vertical video (9:16) for TikTok/Reels
- Typical video length: 45-90 seconds
- Insurance videos: friendly + simple tone works best
- Financial planning: professional + authoritative tone
- Immigration: friendly tone with factual accuracy
