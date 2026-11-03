// Personal-trail producers only. Trip GPS retains its own storage coordinator.
let writes: Promise<unknown> = Promise.resolve();
let writeError: unknown;
const stopped = new Set<string>();
const failed: (() => Promise<unknown>)[] = [];

export function blockPersonalTrailWrites(id: string) { stopped.add(id); }
export function allowPersonalTrailWrites(id: string) { stopped.delete(id); }
export function personalTrailWriteAllowed(id: string) { return !stopped.has(id); }
export function queuePersonalTrailWrite<T>(operation: () => Promise<T>, retainOnFailure = false): Promise<T> {
  const result = writes.then(async () => {
    for (let attempt = 0; ; attempt++) {
      try { return await operation(); }
      catch (error) {
        if (attempt >= 2 || !/database is locked|SQLITE_BUSY|SQLITE_LOCKED|code 5\b/i.test(String(error))) throw error;
        await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  });
  writes = result.catch(error => {
    if (retainOnFailure) { writeError = error; failed.push(operation); }
  });
  return result;
}
export async function drainPersonalTrailWrites() {
  await writes;
  if (writeError) {
    const error = writeError; writeError = undefined;
    const retry = failed.splice(0);
    for (let index = 0; index < retry.length; index++) {
      try { await queuePersonalTrailWrite(retry[index], true); }
      catch (retryError) { failed.push(...retry.slice(index + 1)); throw retryError; }
    }
    // Surface the failure once; the user can retry Finish after reviewing it.
    throw error;
  }
}
