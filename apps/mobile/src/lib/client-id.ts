/**
 * A client-generated idempotency key for a new set.
 *
 * `createWorkoutSetSchema` requires `clientId`, and it exists so a retried
 * request converges instead of creating a duplicate set — which is why the
 * client generates it rather than the server.
 *
 * Hand-rolled rather than `crypto.randomUUID()`: React Native's global
 * `crypto` does not implement it on all runtimes, and this is called on a
 * user tap where a missing polyfill would be a crash.
 */
export function createClientId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
