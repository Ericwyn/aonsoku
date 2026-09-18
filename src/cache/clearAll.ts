import { del, keys } from 'idb-keyval'
import { queryClient } from '@/lib/queryClient'
import { isDesktop } from '@/utils/desktop'
import { logger } from '@/utils/logger'
import { queryKeys } from '@/utils/queryKeys'
import { notifyCachesCleared } from './events'

const IDB_CACHE_PREFIXES = ['lyrics:', 'animated-artwork:']
const IMAGE_CACHE_NAME = 'images'

async function clearIndexedDbCaches() {
  const allKeys = await keys()
  const targeted = allKeys.filter(
    (key): key is string =>
      typeof key === 'string' &&
      IDB_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)),
  )

  await Promise.all(targeted.map((key) => del(key)))

  const remainingKeys = await keys()
  const remainingTargeted = remainingKeys.filter((key) =>
    targeted.includes(key as string),
  )

  logger.info(
    `[Cache] IndexedDB cleanup ${JSON.stringify({
      matched: targeted.length,
      deleted: targeted.length - remainingTargeted.length,
      remaining: remainingTargeted.length,
    })}`,
  )
}

async function clearImageCacheStorage() {
  if (typeof caches === 'undefined') return

  try {
    await caches.delete(IMAGE_CACHE_NAME)
  } catch {}
}

async function clearHttpCache() {
  if (!isDesktop()) return
  await window.api.clearHttpCache()
}

async function invalidateInMemoryCaches() {
  await Promise.all([
    queryClient.resetQueries({ queryKey: [queryKeys.song.lyrics] }),
    queryClient.resetQueries({
      queryKey: [queryKeys.album.animatedArtwork],
    }),
  ])
}

export async function clearAllCaches() {
  logger.info('[Cache] clearing all caches')
  await Promise.all([
    clearIndexedDbCaches(),
    clearImageCacheStorage(),
    clearHttpCache(),
  ])
  await invalidateInMemoryCaches()
  notifyCachesCleared()
  logger.info('[Cache] all cache layers cleared and active queries reset')
}
