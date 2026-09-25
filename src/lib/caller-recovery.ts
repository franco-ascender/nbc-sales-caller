export interface RecoveryLock {
  busy: boolean;
  queued: { cursor?: string } | null;
}

export function beginRecovery(lock: RecoveryLock, cursor?: string): "started" | "queued" {
  if (lock.busy) { lock.queued = cursor === undefined ? {} : { cursor }; return "queued"; }
  lock.busy = true;
  return "started";
}

export function finishRecovery(lock: RecoveryLock): { cursor?: string } | null {
  lock.busy = false;
  const queued = lock.queued;
  lock.queued = null;
  return queued;
}
