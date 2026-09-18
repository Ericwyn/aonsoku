import { useInfiniteQuery } from '@tanstack/react-query'
import { SortingState, Updater } from '@tanstack/react-table'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ShadowHeader } from '@/app/components/album/shadow-header'
import { InfinitySongListFallback } from '@/app/components/fallbacks/song-fallbacks'
import { HeaderTitle } from '@/app/components/header-title'
import { ClearFilterButton } from '@/app/components/search/clear-filter-button'
import { ExpandableSearchInput } from '@/app/components/search/expandable-input'
import { Button } from '@/app/components/ui/button'
import { DataTableList } from '@/app/components/ui/data-table-list'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select'
import { useTotalSongs } from '@/app/hooks/use-total-songs'
import { songsColumns } from '@/app/tables/songs-columns'
import { sortedSongsSearch } from '@/queries/songs'
import { usePlayerActions } from '@/store/player.store'
import { ColumnFilter } from '@/types/columnFilter'
import { AlbumsFilters, AlbumsSearchParams } from '@/utils/albumsFilter'
import { queryKeys } from '@/utils/queryKeys'
import { SearchParamsHandler } from '@/utils/searchParamsHandler'

const DEFAULT_OFFSET = 100
const SONG_SORT_FIELD_KEY = 'songs-sort-field'
const SONG_SORT_ORDER_KEY = 'songs-sort-order'

export default function SongList() {
  const { t } = useTranslation()
  const { setSongList } = usePlayerActions()
  const [searchParams, setSearchParams] = useSearchParams()
  const { getSearchParam } = new SearchParamsHandler(searchParams)
  const sortField = getSearchParam<'recently_added' | 'play_count'>(
    'sort',
    (localStorage.getItem(SONG_SORT_FIELD_KEY) as
      | 'recently_added'
      | 'play_count') ?? 'recently_added',
  )
  const sortOrder = getSearchParam<'ASC' | 'DESC'>(
    'order',
    (localStorage.getItem(SONG_SORT_ORDER_KEY) as 'ASC' | 'DESC') ?? 'DESC',
  )
  const columns = songsColumns().map((column) => ({
    ...column,
    enableSorting: column.id === 'playCount' || column.id === 'created',
  }))

  const filter = getSearchParam<string>(AlbumsSearchParams.MainFilter, '')
  const query = getSearchParam<string>(AlbumsSearchParams.Query, '')
  const artistId = getSearchParam<string>(AlbumsSearchParams.ArtistId, '')
  const artistName = getSearchParam<string>(AlbumsSearchParams.ArtistName, '')

  const searchFilterIsSet = filter === AlbumsFilters.Search && query !== ''
  const filterByArtist = artistId !== '' && artistName !== ''
  const hasSomeFilter = searchFilterIsSet || filterByArtist

  useEffect(() => {
    localStorage.setItem(SONG_SORT_FIELD_KEY, sortField)
    localStorage.setItem(SONG_SORT_ORDER_KEY, sortOrder)
  }, [sortField, sortOrder])

  async function fetchSongs({ pageParam = 0 }) {
    return sortedSongsSearch({
      query: searchFilterIsSet ? query : '',
      songCount: DEFAULT_OFFSET,
      songOffset: pageParam,
      sort: sortField,
      order: sortOrder,
      artistId: filterByArtist ? artistId : undefined,
    })
  }

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      queryKey: [
        queryKeys.song.all,
        filter,
        query,
        artistId,
        sortField,
        sortOrder,
      ],
      initialPageParam: 0,
      queryFn: fetchSongs,
      getNextPageParam: (lastPage) => lastPage.nextOffset,
    })

  const { data: songCountData, isLoading: songCountIsLoading } = useTotalSongs()

  if (isLoading && !isFetchingNextPage) {
    return <InfinitySongListFallback />
  }
  if (!data) return null

  const songlist = data.pages.flatMap((page) => page.songs) ?? []
  const songCount = (hasSomeFilter ? songlist.length : songCountData) ?? 0

  function handlePlaySong(index: number) {
    if (!songlist) return

    setSongList(songlist, index, false, {
      type: 'songs',
      id: 'songs',
      name: t('sidebar.songs'),
    })
  }

  const columnsToShow: ColumnFilter[] = [
    'index',
    'title',
    'album',
    'duration',
    'playCount',
    'played',
    'created',
    'contentType',
    'select',
  ]

  const title = filterByArtist
    ? t('songs.list.byArtist', { artist: artistName })
    : t('sidebar.songs')

  const sorting: SortingState = [
    {
      id: sortField === 'recently_added' ? 'created' : 'playCount',
      desc: sortOrder === 'DESC',
    },
  ]

  function updateSort(
    field: 'recently_added' | 'play_count',
    order = sortOrder,
  ) {
    setSearchParams((state) => {
      state.set('sort', field)
      state.set('order', order)
      return state
    })
  }

  function handleTableSorting(updater: Updater<SortingState>) {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const selected = next[0]
    const field = selected?.id === 'playCount' ? 'play_count' : 'recently_added'
    const order = selected ? (selected.desc ? 'DESC' : 'ASC') : 'ASC'
    updateSort(field, order)
  }

  return (
    <div className="w-full h-content">
      <ShadowHeader
        showGlassEffect={false}
        fixed={false}
        className="relative w-full justify-between items-center"
      >
        <HeaderTitle
          title={title}
          count={songCount}
          loading={songCountIsLoading}
        />

        <div className="flex gap-2 flex-1 justify-end">
          {filterByArtist && <ClearFilterButton />}
          <Select
            value={sortField}
            onValueChange={(value) => updateSort(value as typeof sortField)}
          >
            <SelectTrigger
              className="h-8 w-[150px]"
              aria-label={t('songs.list.sort.field')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="recently_added">
                {t('songs.list.sort.added')}
              </SelectItem>
              <SelectItem value="play_count">
                {t('songs.list.sort.plays')}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            aria-label={t(
              sortOrder === 'ASC'
                ? 'songs.list.sort.ascending'
                : 'songs.list.sort.descending',
            )}
            onClick={() =>
              updateSort(sortField, sortOrder === 'ASC' ? 'DESC' : 'ASC')
            }
          >
            {sortOrder === 'ASC' ? (
              <ArrowUp className="w-4 h-4" />
            ) : (
              <ArrowDown className="w-4 h-4" />
            )}
          </Button>
          <ExpandableSearchInput
            placeholder={t('songs.list.search.placeholder')}
          />
        </div>
      </ShadowHeader>

      <div className="w-full h-[calc(100%-80px)] overflow-auto">
        <DataTableList
          key={`${filter}:${query}:${artistId}:${sortField}:${sortOrder}`}
          columns={columns}
          data={songlist}
          handlePlaySong={(row) => handlePlaySong(row.index)}
          columnFilter={columnsToShow}
          fetchNextPage={fetchNextPage}
          hasNextPage={hasNextPage}
          enableSorting
          sorting={sorting}
          onSortingChange={handleTableSorting}
        />
      </div>
    </div>
  )
}
