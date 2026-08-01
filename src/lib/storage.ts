import type { Project, MediaItem } from "../stores/types";
import type { TimelineClip, TimelineTransition } from "../stores/editor-store";
import { createEmptyProject } from "../stores/types";

const DB_NAME = "zhiying-dashboard";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";

export interface PersistedEditorState {
  videoSrc: string | null;
  clips: TimelineClip[];
  transitions: TimelineTransition[];
  markers: number[];
  beatMarkers: number[];
  duration: number;
  sourceDuration: number;
  trimStart: number;
  trimEnd: number;
  currentTime: number;
  selectedClipId: string | null;
}

export interface StoredProjectRecord {
  id: string;
  name: string;
  thumbnail?: string;
  createdAt: number;
  lastOpened: number;
  project: Project;
  editor: PersistedEditorState;
}

export interface StoredProjectSummary {
  id: string;
  name: string;
  thumbnail?: string;
  createdAt: number;
  lastOpened: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("打开 IndexedDB 失败"));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_PROJECTS, mode);
        const store = transaction.objectStore(STORE_PROJECTS);
        const request = run(store);
        let requestError: unknown = null;
        let result: T;

        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => {
          requestError = request.error ?? new Error("IndexedDB 请求失败");
        };
        transaction.oncomplete = () => {
          db.close();
          if (requestError) {
            reject(requestError);
            return;
          }
          resolve(result);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? requestError ?? new Error("IndexedDB 事务失败"));
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error ?? requestError ?? new Error("IndexedDB 事务已中止"));
        };
      })
  );
}

function cloneEditorState(editor: PersistedEditorState): PersistedEditorState {
  return {
    ...editor,
    clips: editor.clips.map((c) => ({ ...c })),
    transitions: editor.transitions.map((t) => ({ ...t })),
    markers: [...editor.markers],
    beatMarkers: [...editor.beatMarkers],
  };
}

function cloneProject(project: Project): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => ({ ...c })),
    })),
    mediaItems: project.mediaItems.map((m) => ({ ...m })),
  };
}

function isBlobLike(value: unknown): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function rebuildMediaUrls(items: MediaItem[]): { mediaItems: MediaItem[]; urlMap: Map<string, string> } {
  const urlMap = new Map<string, string>();
  const mediaItems = items.map((item) => {
    // Backward compatibility: some historical records may not have a valid Blob/File.
    if (!isBlobLike(item.file)) {
      return { ...item };
    }
    const nextUrl = URL.createObjectURL(item.file);
    urlMap.set(item.url, nextUrl);
    return { ...item, url: nextUrl };
  });
  return { mediaItems, urlMap };
}

function hydrateRecord(record: StoredProjectRecord): StoredProjectRecord {
  const project = cloneProject(record.project);
  const { mediaItems, urlMap } = rebuildMediaUrls(project.mediaItems);
  project.mediaItems = mediaItems;
  const editor = cloneEditorState(record.editor);
  editor.videoSrc = editor.videoSrc ? urlMap.get(editor.videoSrc) ?? editor.videoSrc : null;
  editor.clips = editor.clips.map((clip) => ({
    ...clip,
    src: urlMap.get(clip.src) ?? clip.src,
  }));
  return {
    ...record,
    project,
    editor,
  };
}

export function createEmptyEditorSnapshot(duration = 60): PersistedEditorState {
  return {
    videoSrc: null,
    clips: [],
    transitions: [],
    markers: [],
    beatMarkers: [],
    duration,
    sourceDuration: duration,
    trimStart: 0,
    trimEnd: duration,
    currentTime: 0,
    selectedClipId: null,
  };
}

export async function createProjectRecord(name: string, videoUrl?: string): Promise<StoredProjectRecord> {
  const now = Date.now();
  const project = createEmptyProject(name);
  const editorSnapshot = createEmptyEditorSnapshot(60);
  if (videoUrl) {
    editorSnapshot.videoSrc = videoUrl;
  }
  const record: StoredProjectRecord = {
    id: project.id,
    name,
    createdAt: now,
    lastOpened: now,
    project,
    editor: editorSnapshot,
  };
  await saveProjectRecord(record);
  return hydrateRecord(record);
}

export async function saveProjectRecord(record: StoredProjectRecord): Promise<void> {
  const payload: StoredProjectRecord = {
    ...record,
    project: cloneProject(record.project),
    editor: cloneEditorState(record.editor),
  };
  await tx("readwrite", (store) => store.put(payload));
}

export async function getProjectRecord(projectId: string): Promise<StoredProjectRecord | null> {
  const raw = (await tx<StoredProjectRecord | undefined>("readonly", (store) => store.get(projectId))) ?? null;
  return raw ? hydrateRecord(raw) : null;
}

export async function listProjectSummaries(): Promise<StoredProjectSummary[]> {
  const records = (await tx<StoredProjectRecord[]>("readonly", (store) => store.getAll())) ?? [];
  return records
    .map((r) => ({
      id: r.id,
      name: r.name,
      thumbnail: r.thumbnail,
      createdAt: r.createdAt,
      lastOpened: r.lastOpened,
    }))
    .sort((a, b) => b.lastOpened - a.lastOpened);
}

export async function deleteProjectRecord(projectId: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(projectId));
}
