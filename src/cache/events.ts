export const CACHE_CLEARED_EVENT = 'aonsoku-cache-cleared'

export function notifyCachesCleared() {
  window.dispatchEvent(new Event(CACHE_CLEARED_EVENT))
}
