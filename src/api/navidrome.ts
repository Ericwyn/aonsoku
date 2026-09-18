import { ISong } from '@/types/responses/song'

interface NativeLoginResponse {
  token: string
}

interface NativeSong extends Partial<ISong> {
  trackNumber?: number
  createdAt?: string
  playDate?: string
}

function serverUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

export async function navidromeLogin(
  baseUrl: string,
  username: string,
  password: string,
) {
  try {
    const response = await fetch(serverUrl(baseUrl, '/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!response.ok) return undefined

    const data = (await response.json()) as NativeLoginResponse
    return data.token
  } catch {
    return undefined
  }
}

export type SongSortField = 'recently_added' | 'play_count'
export type SongSortOrder = 'ASC' | 'DESC'

interface NativeSongSearchParams {
  baseUrl: string
  token: string
  offset: number
  count: number
  sort: SongSortField
  order: SongSortOrder
  query?: string
  artistId?: string
}

function toSubsonicSong(song: NativeSong): ISong {
  return {
    ...song,
    id: song.id ?? '',
    parent: song.parent ?? song.albumId ?? '',
    isDir: false,
    title: song.title ?? '',
    album: song.album ?? '',
    artist: song.artist ?? '',
    track: song.track ?? song.trackNumber ?? 0,
    year: song.year ?? 0,
    coverArt: song.coverArt ?? song.albumId ?? '',
    size: song.size ?? 0,
    contentType: song.contentType ?? '',
    suffix: song.suffix ?? '',
    duration: song.duration ?? 0,
    bitRate: song.bitRate ?? 0,
    path: song.path ?? '',
    discNumber: song.discNumber ?? 0,
    created: song.created ?? song.createdAt ?? '',
    albumId: song.albumId ?? '',
    type: song.type ?? 'music',
    isVideo: song.isVideo ?? false,
    played: song.played ?? song.playDate,
    bpm: song.bpm ?? 0,
    comment: song.comment ?? '',
    sortName: song.sortName ?? '',
    mediaType: song.mediaType ?? 'song',
    musicBrainzId: song.musicBrainzId ?? '',
    genres: song.genres ?? [],
    replayGain: song.replayGain ?? {
      trackGain: 0,
      trackPeak: 0,
      albumGain: 0,
      albumPeak: 0,
    },
  }
}

export async function navidromeSongSearch(params: NativeSongSearchParams) {
  const searchParams = new URLSearchParams({
    _start: params.offset.toString(),
    _end: (params.offset + params.count).toString(),
    _sort: params.sort,
    _order: params.order,
    missing: 'false',
  })

  if (params.query) searchParams.set('title', params.query)
  if (params.artistId) searchParams.set('artists_id', params.artistId)

  const response = await fetch(
    serverUrl(params.baseUrl, `/api/song?${searchParams.toString()}`),
    {
      headers: {
        Accept: 'application/json',
        'X-ND-Authorization': `Bearer ${params.token}`,
      },
    },
  )

  if (!response.ok)
    throw new Error(`Navidrome song request failed: ${response.status}`)

  const songs = ((await response.json()) as NativeSong[]).map(toSubsonicSong)
  const total = Number(response.headers.get('x-total-count') ?? 0)
  const refreshedToken = response.headers.get('X-ND-Authorization')

  return {
    songs,
    total,
    refreshedToken: refreshedToken?.replace(/^Bearer\s+/i, ''),
    nextOffset:
      songs.length === params.count && params.offset + songs.length < total
        ? params.offset + songs.length
        : null,
  }
}
