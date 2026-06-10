/**
 * 智映 ↔ diffusionstudio/core 桥接服务
 * 将 project-store 中的项目数据同步到 Composition 实例
 */

import * as core from "@diffusionstudio/core";
import type { Project } from "../stores/types";

let composition: core.Composition | null = null;
let playerEl: HTMLDivElement | null = null;

/** 初始化 Composition，挂载到容器 */
export async function initComposition(
  container: HTMLDivElement,
  width = 1920,
  height = 1080,
) {
  if (composition) {
    composition.unmount();
  }

  composition = new core.Composition({
    width,
    height,
    background: "#000000",
  });

  playerEl = document.createElement("div");
  container.appendChild(playerEl);
  composition.mount(playerEl);

  // Scale to fit
  const scale = Math.min(
    container.clientWidth / composition.width,
    container.clientHeight / composition.height,
  );
  playerEl.style.width = `${composition.width}px`;
  playerEl.style.height = `${composition.height}px`;
  playerEl.style.transform = `scale(${scale})`;
  playerEl.style.transformOrigin = "center";
  playerEl.style.position = "absolute";
  playerEl.style.left = "50%";
  playerEl.style.top = "50%";
  playerEl.style.transform = `translate(-50%, -50%) scale(${scale})`;

  return composition;
}

/** 从项目数据重新构建 Composition */
export async function buildFromProject(project: Project) {
  if (!composition) return;

  // 清除所有已有的 layers
  for (const layer of composition.layers) {
    composition.remove(layer);
  }

  if (project.tracks.every((t) => t.clips.length === 0)) {
    return; // 无内容
  }

  // 预加载所有 sources
  const sourceCache = new Map<string, core.VideoSource | core.ImageSource>();

  for (const media of project.mediaItems) {
    try {
      if (media.type === "video") {
        const src = await core.Source.from<core.VideoSource>(media.url);
        sourceCache.set(media.id, src);
      } else if (media.type === "image") {
        const src = await core.Source.from<core.ImageSource>(media.url);
        sourceCache.set(media.id, src);
      }
    } catch (e) {
      console.warn(`Failed to load source: ${media.name}`, e);
    }
  }

  // 为每个轨道创建一个 Layer
  for (const track of project.tracks) {
    if (track.clips.length === 0) continue;

    const layer = new core.Layer({
      // SEQUENTIAL 让片段按时间顺序排列
      mode: track.type === "video" ? "SEQUENTIAL" : "SEQUENTIAL",
    });

    await composition.add(layer);

    for (const clip of track.clips) {
      const source = sourceCache.get(clip.mediaId);
      if (!source) continue;

      try {
        if (clip.type === "video" && source instanceof core.VideoSource) {
          await layer.add(
            new core.VideoClip(source, {
              position: "center",
              width: composition.width,
              height: composition.height,
              range: [clip.mediaOffset || 0, (clip.mediaOffset || 0) + clip.duration],
              delay: clip.start,
            }),
          );
        } else if (clip.type === "image" && source instanceof core.ImageSource) {
          await layer.add(
            new core.ImageClip(source, {
              position: "center",
              width: composition.width,
              height: composition.height,
              duration: clip.duration,
              delay: clip.start,
            }),
          );
        }
      } catch (e) {
        console.warn(`Failed to add clip: ${clip.name}`, e);
      }
    }
  }
}

/** 播放控制 */
export function play() {
  composition?.play();
}

export function pause() {
  composition?.pause();
}

export function seek(time: number) {
  composition?.seek(time);
}

export function getCurrentTime(): number {
  return composition?.currentTime ?? 0;
}

export function getDuration(): number {
  return composition?.duration ?? 0;
}

export function isPlaying(): boolean {
  return composition?.playing ?? false;
}

export function onTimeUpdate(cb: (time: number | undefined) => void) {
  composition?.on("playback:time", cb);
}

export function destroy() {
  if (composition) {
    composition.unmount();
    composition = null;
  }
  if (playerEl && playerEl.parentNode) {
    playerEl.parentNode.removeChild(playerEl);
    playerEl = null;
  }
}
