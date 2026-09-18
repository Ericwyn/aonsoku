import {
  navidromeSongSearch,
  SongSortField,
  SongSortOrder,
} from '@/api/navidrome'
import { SearchQueryOptions } from '@/service/search'
import { subsonic } from '@/service/subsonic'
import { useAppStore } from '@/store/app.store'
import { ISong } from '@/types/responses/song'

const emptyResponse = { songs: [], nextOffset: null }

type SongSearchParams = Required<
  Pick<SearchQueryOptions, 'query' | 'songCount' | 'songOffset'>
>

export async function songsSearch(params: SongSearchParams) {
  const response = await subsonic.search.get({
    artistCount: 0,
    albumCount: 0,
    ...params,
  })

  if (!response) return emptyResponse
  if (!response.song) return emptyResponse

  let nextOffset: number | null = null
  if (response.song.length >= params.songCount) {
    nextOffset = params.songOffset + params.songCount
  }

  return {
    songs: response.song,
    nextOffset,
  }
}

interface SortedSongSearchParams extends SongSearchParams {
  sort: SongSortField
  order: SongSortOrder
  artistId?: string
}

function sortSongs(
  songs: Awaited<ReturnType<typeof songsSearch>>['songs'],
  sort: SongSortField,
  order: SongSortOrder,
) {
  const direction = order === 'ASC' ? 1 : -1

  return [...songs].sort((a, b) => {
    const first =
      sort === 'play_count'
        ? (a.playCount ?? 0)
        : new Date(a.created || 0).getTime()
    const second =
      sort === 'play_count'
        ? (b.playCount ?? 0)
        : new Date(b.created || 0).getTime()

    return (first - second) * direction
  })
}

async function getAllMatchingSongs(params: SortedSongSearchParams) {
  if (params.artistId) {
    const result = await getArtistAllSongs(params.artistId)
    return sortSongs(result.songs, params.sort, params.order)
  }

  const songs: ISong[] = []
  const pageSize = 500
  let offset = 0

  while (true) {
    const page = await songsSearch({
      query: params.query,
      songCount: pageSize,
      songOffset: offset,
    })
    songs.push(...page.songs)
    if (page.nextOffset === null) break
    offset = page.nextOffset
  }

  return sortSongs(songs, params.sort, params.order)
}

export async function sortedSongsSearch(params: SortedSongSearchParams) {
  const { url, nativeToken, serverType } = useAppStore.getState().data

  if (serverType === 'navidrome' && nativeToken) {
    try {
      const result = await navidromeSongSearch({
        baseUrl: url,
        token: nativeToken,
        offset: params.songOffset,
        count: params.songCount,
        sort: params.sort,
        order: params.order,
        query: params.query,
        artistId: params.artistId,
      })

      if (result.refreshedToken) {
        useAppStore.setState((state) => {
          state.data.nativeToken = result.refreshedToken
        })
      }

      return result
    } catch (error) {
      console.warn(
        'Native Navidrome sorting failed; using Subsonic fallback.',
        error,
      )
    }
  }

  if (params.songOffset > 0) return emptyResponse

  return {
    songs: await getAllMatchingSongs(params),
    nextOffset: null,
  }
}

export async function getArtistAllSongs(artistId: string) {
  const artist = await subsonic.artists.getOne(artistId)

  if (!artist || !artist.album) return emptyResponse

  const results = await Promise.all(
    artist.album.map(({ id }) => subsonic.albums.getOne(id)),
  )

  const songs = results.flatMap((result) => {
    if (!result) return []

    return result.song
  })

  return {
    songs,
    nextOffset: null,
  }
}

export async function getFavoriteSongs() {
  const response = await subsonic.songs.getFavoriteSongs()

  if (!response || !response.song) return { songs: [] }

  return { songs: response.song }
}
