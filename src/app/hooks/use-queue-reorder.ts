import { DragEvent, useCallback, useState } from 'react'
import { usePlayerActions } from '@/store/player.store'

export function useQueueReorder() {
  const { moveSongInQueue } = usePlayerActions()
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const onDragStart = useCallback(
    (event: DragEvent<HTMLElement>, index: number) => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', index.toString())
      setDraggedIndex(index)
    },
    [],
  )

  const onDragOver = useCallback(
    (event: DragEvent<HTMLElement>, index: number) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDragOverIndex(index)
    },
    [],
  )

  const resetDragState = useCallback(() => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }, [])

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>, index: number) => {
      event.preventDefault()

      const transferredValue = event.dataTransfer.getData('text/plain')
      const transferredIndex = Number(transferredValue)
      const fromIndex =
        transferredValue !== '' && Number.isInteger(transferredIndex)
          ? transferredIndex
          : draggedIndex

      if (fromIndex !== null) {
        moveSongInQueue(fromIndex, index)
      }

      resetDragState()
    },
    [draggedIndex, moveSongInQueue, resetDragState],
  )

  return {
    draggedIndex,
    dragOverIndex,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd: resetDragState,
  }
}
