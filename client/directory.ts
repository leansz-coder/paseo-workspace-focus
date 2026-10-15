export interface Page<T> { entries: T[]; pageInfo: { hasMore: boolean; nextCursor?: string | null } }

/** One independently recoverable subscription, with a journal for in-flight pages. */
export function createDirectory<T extends { id: string }>(load: (cursor: string) => Promise<Page<T>>, changed: () => void) {
  let epoch = 0, disposed = false;
  let values = new Map<string, T>();
  const pendingChanges = new Set<string>();
  const state = { ready: false, complete: false, error: null as string | null };
  function fail(error: unknown) {
    if (disposed) return;
    epoch++; state.ready = true; state.complete = false;
    state.error = error instanceof Error ? error.message : String(error);
    pendingChanges.clear(); changed();
  }
  async function snapshot(first: Page<T>) {
    if (disposed) return;
    const revision = ++epoch;
    values = new Map(first.entries.map(value => [value.id, value])); pendingChanges.clear();
    state.ready = true; state.complete = !first.pageInfo.hasMore; state.error = null; changed();
    let page = first;
    const cursors = new Set<string>();
    try {
      while (page.pageInfo.hasMore) {
        const cursor = page.pageInfo.nextCursor;
        if (!cursor || cursors.has(cursor)) throw Error('分页游标无效，请重新读取');
        cursors.add(cursor);
        page = await load(cursor);
        if (disposed || revision !== epoch) return;
        for (const value of page.entries) if (!pendingChanges.has(value.id)) values.set(value.id, value);
        changed();
      }
      state.complete = true; pendingChanges.clear(); changed();
    } catch (error) { if (!disposed && revision === epoch) fail(error); }
  }
  return {
    state, values: () => [...values.values()], snapshot, fail,
    update(id: string, value: T | null) {
      if (disposed) return;
      if (!state.complete) pendingChanges.add(id);
      if (value) values.set(id, value); else values.delete(id);
      changed();
    },
    invalidate() { epoch++; state.complete = false; state.ready = false; state.error = null; pendingChanges.clear(); changed(); },
    dispose() { disposed = true; epoch++; values.clear(); pendingChanges.clear(); },
  };
}
