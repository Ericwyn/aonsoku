import { del, get, set } from 'idb-keyval'
import { iso6392BTo1, iso6392TTo1 } from 'iso-639-2'
import { httpClient } from '@/api/httpClient'
import { useAppStore } from '@/store/app.store'
import { usePlayerStore } from '@/store/player.store'
import {
  ILyric,
  IStructuredLine,
  IStructuredLyric,
  LyricsResponse,
  StructuredLyricsResponse,
} from '@/types/responses/song'
import { lrclibClient } from '@/utils/appName'
import { logger } from '@/utils/logger'
import { checkServerType, getServerExtensions } from '@/utils/servers'

// normalizes the ISO 639 code returned by the server to the BCP 47 language tag recognized by the html lang selector
function normalizeLangCode(lang: string | undefined): string | undefined {
  if (!lang) return lang

  const parts = lang.split('-')
  const primary = parts[0].toLowerCase()

  const mapped = iso6392BTo1[primary] ?? iso6392TTo1[primary]
  if (mapped) {
    parts[0] = mapped
    return parts.join('-')
  }

  return lang
}

interface GetLyricsData {
  id: string
  artist: string
  title: string
  album?: string
  duration?: number
}

interface LRCLibResponse {
  id: number
  trackName: string
  artistName: string
  plainLyrics: string
  syncedLyrics: string
}

function lyricDiagnostics(value?: string) {
  if (!value) return { length: 0, replacementCharacters: 0, preview: '' }

  return {
    length: value.length,
    replacementCharacters: value.match(/�/g)?.length ?? 0,
    preview: value.slice(0, 240).replaceAll('\n', '\\n'),
  }
}

function hasInvalidEncoding(value?: string) {
  return value?.includes('�') ?? false
}

function logLyrics(stage: string, details: Record<string, unknown>) {
  logger.info(`[Lyrics] ${stage} ${JSON.stringify(details)}`)
}

async function getLyrics(getLyricsData: GetLyricsData) {
  const { preferSyncedLyrics } = usePlayerStore.getState().settings.lyrics
  const { songLyricsEnabled } = getServerExtensions()
  const cacheEnabled = useAppStore.getState().pages.lyricsCacheEnabled

  const cacheKey = getLyricsCacheKey(
    getLyricsData,
    preferSyncedLyrics,
    songLyricsEnabled,
  )

  const readCache = cacheEnabled
    ? (key: string) => get(key)
    : async () => undefined
  const writeCache = cacheEnabled
    ? (key: string, value: unknown) => set(key, value)
    : () => undefined

  const cachedLyrics = await readCache(cacheKey)

  if (cachedLyrics) {
    const cached = cachedLyrics as ILyric
    const diagnostics = lyricDiagnostics(cached.value)

    if (!hasInvalidEncoding(cached.value)) {
      logLyrics('cache hit', {
        song: getLyricsData,
        cacheKey,
        lyrics: diagnostics,
      })
      return cachedLyrics
    }

    logLyrics('discarded corrupt cache entry', {
      song: getLyricsData,
      cacheKey,
      lyrics: diagnostics,
    })
    await del(cacheKey)
  }

  logLyrics('cache miss', {
    song: getLyricsData,
    cacheKey,
    cacheEnabled,
    preferSyncedLyrics,
    songLyricsEnabled,
  })

  // The server owns the choice between embedded tags, sidecar files and any
  // server-side providers. Prefer every valid server result over LRCLIB.

  if (songLyricsEnabled) {
    const response = await httpClient<StructuredLyricsResponse>(
      '/getLyricsBySongId',
      {
        method: 'GET',
        cache: 'no-store',
        query: {
          id: getLyricsData.id,
        },
      },
    )

    if (response) {
      const { structuredLyrics } = response.data.lyricsList

      logLyrics('Navidrome getLyricsBySongId response', {
        song: getLyricsData,
        variants: structuredLyrics?.map((item) => ({
          synced: item.synced,
          lang: item.lang,
          lineCount: item.line.length,
          lyrics: lyricDiagnostics(
            item.line.map((line) => line.value).join('\n'),
          ),
        })),
      })

      if (structuredLyrics && structuredLyrics.length > 0) {
        const validLyrics = structuredLyrics.filter(
          (lyrics) =>
            !hasInvalidEncoding(
              lyrics.line.map((line) => line.value).join('\n'),
            ),
        )
        const syncedLyrics = validLyrics.find((lyrics) => lyrics.synced)
        const unsyncedLyrics = validLyrics.find((lyrics) => !lyrics.synced)

        if (validLyrics.length !== structuredLyrics.length) {
          logLyrics('ignored corrupt Navidrome structured lyrics', {
            ignoredVariants: structuredLyrics.length - validLyrics.length,
          })
        }

        const selectedLyrics = preferSyncedLyrics
          ? (syncedLyrics ?? unsyncedLyrics)
          : (unsyncedLyrics ?? syncedLyrics)

        if (selectedLyrics) {
          const serverLyrics = osStructuredLyricsToILyric(selectedLyrics)

          logLyrics('selected Navidrome structured lyrics', {
            synced: selectedLyrics.synced,
            lyrics: lyricDiagnostics(serverLyrics.value),
          })

          writeCache(cacheKey, serverLyrics)

          return serverLyrics
        }
      }
    }
  }

  const response = await httpClient<LyricsResponse>('/getLyrics', {
    method: 'GET',
    cache: 'no-store',
    query: {
      artist: getLyricsData.artist,
      title: getLyricsData.title,
    },
  })

  const legacyLyrics = response?.data.lyrics
  const legacyLyricsCorrupt = hasInvalidEncoding(legacyLyrics?.value)
  const lyricNotFound = !legacyLyrics?.value || legacyLyricsCorrupt

  logLyrics('Navidrome getLyrics response', {
    song: getLyricsData,
    found: !lyricNotFound,
    lyrics: lyricDiagnostics(response?.data.lyrics?.value),
  })

  if (legacyLyricsCorrupt) {
    logLyrics('ignored corrupt Navidrome legacy lyrics', {
      lyrics: lyricDiagnostics(legacyLyrics?.value),
    })
  }

  if (legacyLyrics && !legacyLyricsCorrupt) {
    logLyrics('selected Navidrome legacy lyrics', {
      lyrics: lyricDiagnostics(legacyLyrics.value),
    })
    writeCache(cacheKey, legacyLyrics)

    return legacyLyrics
  }

  const lrclibLyrics = await getLyricsFromLRCLib(getLyricsData)

  if (lrclibLyrics.value !== '') {
    logLyrics('selected LRCLIB fallback lyrics', {
      lyrics: lyricDiagnostics(lrclibLyrics.value),
    })
    writeCache(cacheKey, lrclibLyrics)
  }

  return lrclibLyrics
}

async function getLyricsFromLRCLib(getLyricsData: GetLyricsData) {
  const { lrclib } = usePlayerStore.getState().settings.privacy
  const { isLms } = checkServerType()

  const { title, album, duration } = getLyricsData

  // LMS server tends to join all artists into a single string
  // Ex: "Cartoon, Jeja, Daniel Levi, Time To Talk"
  // To LRCLIB work correctly, we have to send only one
  const artist = isLms
    ? getLyricsData.artist.split(',')[0]
    : getLyricsData.artist

  if (!lrclib.enabled || window.DISABLE_LRCLIB) {
    logLyrics('LRCLIB skipped', {
      enabledInSettings: lrclib.enabled,
      disabledByEnvironment: Boolean(window.DISABLE_LRCLIB),
    })
    return {
      artist,
      title,
      value: '',
      lang: 'xxx',
    }
  }

  try {
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
    })

    if (duration) params.append('duration', duration.toString())
    if (album) params.append('album_name', album)

    let defaultLrcLibUrl = 'https://lrclib.net/api/get'

    if (lrclib.customUrlEnabled && lrclib.customUrl !== '') {
      defaultLrcLibUrl = `${lrclib.customUrl}/api/get`
    }

    const url = new URL(defaultLrcLibUrl)
    url.search = params.toString()

    const request = await fetch(url.toString(), {
      cache: 'no-store',
      headers: {
        'Lrclib-Client': lrclibClient,
      },
    })
    const response: LRCLibResponse = await request.json()

    if (response) {
      const { syncedLyrics, plainLyrics } = response

      logLyrics('LRCLIB response', {
        song: getLyricsData,
        synced: lyricDiagnostics(syncedLyrics),
        plain: lyricDiagnostics(plainLyrics),
      })

      let finalLyric = ''

      if (syncedLyrics) {
        finalLyric = syncedLyrics
      } else if (plainLyrics) {
        finalLyric = plainLyrics
      }

      return {
        artist,
        title,
        value: formatLyrics(finalLyric),
        lang: 'xxx',
      }
    }
  } catch (error) {
    logger.error('[Lyrics] LRCLIB request failed', error)
  }

  return {
    artist,
    title,
    value: '',
    lang: 'xxx',
  }
}

function formatLyrics(lyrics: string) {
  return lyrics.trim().replaceAll('\r\n', '\n')
}

function getLyricsCacheKey(
  getLyricsData: GetLyricsData,
  preferSyncedLyrics: boolean,
  songLyricsEnabled?: boolean,
) {
  const { id, artist, title } = getLyricsData
  const serverUrl = useAppStore.getState().data.url

  const type = preferSyncedLyrics ? 'synced' : 'plain'
  const serverExtension = songLyricsEnabled ? 'internal' : 'external'

  const keys = [
    'lyrics',
    encodeURIComponent(serverUrl),
    id,
    artist,
    title,
    type,
    serverExtension,
  ]

  return keys.join(':')
}

function osStructuredLyricsToILyric(lyrics: IStructuredLyric): ILyric {
  return {
    artist: lyrics.displayArtist,
    title: lyrics.displayTitle,
    lang: normalizeLangCode(lyrics.lang),
    value: formatLyrics(lyrics.line.map(osLineToILyricLine).join('\n')),
  }
}

function osLineToILyricLine(line: IStructuredLine): string {
  if (line.start !== undefined) {
    return `[${osStartMsToSongTimestamp(line.start)}] ${line.value}`
  }
  return line.value
}

function osStartMsToSongTimestamp(startTime: number): string {
  // Date() isoString is formatted as:
  // YYYY-MM-DDTHH:mm:ss.sssZ -> mm:ss.ss
  // 2011-10-05T14:48:00.000Z -> 48:00.00
  return new Date(startTime).toISOString().slice(14, -2)
}

export const lyrics = {
  getLyrics,
  getLyricsFromLRCLib,
}
