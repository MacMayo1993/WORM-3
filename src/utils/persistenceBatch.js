// Coalesce synchronous event bursts without postponing durability to a timer.
// Gameplay/store subscribers still see each event immediately. The outermost
// batch flushes each changed storage key once, even if the event throws.
let depth = 0;
const pending = new Map();

export function persistLatest(key, write) {
  if (depth) pending.set(key, write);
  else write();
}

export function withPersistenceBatch(run) {
  depth++;
  try { return run(); }
  finally {
    if (--depth === 0) {
      const writes = [...pending.values()];
      pending.clear();
      for (const write of writes) write();
    }
  }
}
