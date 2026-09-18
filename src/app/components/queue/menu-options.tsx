import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  ListPlus,
  Trash,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { OptionsButtons } from '@/app/components/options/buttons'
import { AddToPlaylistSubMenu } from '@/app/components/song/add-to-playlist'
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/app/components/ui/context-menu'
import { useOptions } from '@/app/hooks/use-options'
import { useAppStore } from '@/store/app.store'
import {
  usePlayerActions,
  usePlayerCurrentSongIndex,
} from '@/store/player.store'
import { ISong } from '@/types/responses/song'

interface QueueMenuOptionsProps {
  song: ISong
  index: number
  queueLength: number
}

const itemIconClass = 'mr-2 h-4 w-4'

export function QueueMenuOptions({
  song,
  index,
  queueLength,
}: QueueMenuOptionsProps) {
  const { t } = useTranslation()
  const { createNewPlaylist, addToPlaylist } = useOptions()
  const hidePlaylistsSection = useAppStore().pages.hidePlaylistsSection
  const { moveSongInQueue, removeSongFromQueue } = usePlayerActions()
  const currentSongIndex = usePlayerCurrentSongIndex()
  const isCurrentSong = index === currentSongIndex
  const nextSongTarget =
    index < currentSongIndex ? currentSongIndex : currentSongIndex + 1

  return (
    <>
      <ContextMenuItem
        disabled={isCurrentSong || index === currentSongIndex + 1}
        onSelect={() => moveSongInQueue(index, nextSongTarget)}
      >
        <ListPlus className={itemIconClass} />
        <span>{t('queue.playNext')}</span>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={index === 0}
        onSelect={() => moveSongInQueue(index, index - 1)}
      >
        <ArrowUp className={itemIconClass} />
        <span>{t('queue.moveUp')}</span>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={index === queueLength - 1}
        onSelect={() => moveSongInQueue(index, index + 1)}
      >
        <ArrowDown className={itemIconClass} />
        <span>{t('queue.moveDown')}</span>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={index === 0}
        onSelect={() => moveSongInQueue(index, 0)}
      >
        <ArrowUpToLine className={itemIconClass} />
        <span>{t('queue.moveToStart')}</span>
      </ContextMenuItem>
      <ContextMenuItem
        disabled={index === queueLength - 1}
        onSelect={() => moveSongInQueue(index, queueLength - 1)}
      >
        <ArrowDownToLine className={itemIconClass} />
        <span>{t('queue.moveToEnd')}</span>
      </ContextMenuItem>

      <ContextMenuSeparator />

      {!hidePlaylistsSection && (
        <>
          <OptionsButtons.AddToPlaylistOption variant="context">
            <AddToPlaylistSubMenu
              type="context"
              newPlaylistFn={() => createNewPlaylist(song.title, song.id)}
              addToPlaylistFn={(id) => addToPlaylist(id, song.id)}
            />
          </OptionsButtons.AddToPlaylistOption>
          <ContextMenuSeparator />
        </>
      )}

      <ContextMenuItem
        className="text-red-500 focus:text-red-500"
        onSelect={() => removeSongFromQueue(song.id)}
      >
        <Trash className={`${itemIconClass} fill-red-300`} />
        <span>{t('queue.removeSong')}</span>
      </ContextMenuItem>
    </>
  )
}
