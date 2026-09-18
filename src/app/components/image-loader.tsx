import { ReactNode, useEffect, useRef, useState } from 'react'
import { getCoverArtUrl } from '@/api/httpClient'
import { CACHE_CLEARED_EVENT } from '@/cache/events'
import { CoverArt } from '@/types/coverArtType'

interface ImageLoaderProps {
  id?: string
  type: CoverArt
  size?: string | number
  children: (src: string | undefined, isLoading: boolean) => ReactNode
}

export function ImageLoader({
  id,
  type,
  size = 300,
  children,
}: ImageLoaderProps) {
  const [src, setSrc] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [cacheRevision, setCacheRevision] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const handleCacheCleared = () =>
      setCacheRevision((revision) => revision + 1)
    window.addEventListener(CACHE_CLEARED_EVENT, handleCacheCleared)

    return () => {
      window.removeEventListener(CACHE_CLEARED_EVENT, handleCacheCleared)
    }
  }, [])

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    setIsLoading(true)
    setSrc('')

    if (!id) {
      setIsLoading(false)
      return
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const fetchImage = async () => {
      try {
        const url = await getCoverArtUrl(
          id,
          type,
          size.toString(),
          cacheRevision.toString(),
        )

        if (!abortController.signal.aborted) {
          setSrc(url)
          setIsLoading(false)
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Error fetching image:', error)
          setIsLoading(false)
        }
      }
    }

    fetchImage()

    return () => {
      abortController.abort()
    }
  }, [id, type, size, cacheRevision])

  return <>{children(src, isLoading)}</>
}
