type Snapshot<T> = {
  state: T;
  label?: string;
};

const MAX_HISTORY = 100;

export class UndoRedoManager<T> {
  private past: Snapshot<T>[] = [];
  private future: Snapshot<T>[] = [];
  private clone: (state: T) => T;

  constructor(clone: (state: T) => T = structuredClone) {
    this.clone = clone;
  }

  recordState(state: T, label?: string): void {
    this.past.push({ state: this.clone(state), label });
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future.length = 0;
  }

  undo(currentState: T): Snapshot<T> | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push({ state: this.clone(currentState) });
    return prev;
  }

  redo(currentState: T): Snapshot<T> | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push({ state: this.clone(currentState) });
    return next;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past.length = 0;
    this.future.length = 0;
  }
}

const globalManager = new UndoRedoManager<unknown>();

export function recordState<T>(state: T, label?: string): void {
  globalManager.recordState(state, label);
}

export function undo<T>(currentState: T): { state: T; label?: string } | null {
  const result = globalManager.undo(currentState as unknown);
  if (!result) return null;
  return result as { state: T; label?: string };
}

export function redo<T>(currentState: T): { state: T; label?: string } | null {
  const result = globalManager.redo(currentState as unknown);
  if (!result) return null;
  return result as { state: T; label?: string };
}

export function canUndo(): boolean {
  return globalManager.canUndo();
}

export function canRedo(): boolean {
  return globalManager.canRedo();
}

