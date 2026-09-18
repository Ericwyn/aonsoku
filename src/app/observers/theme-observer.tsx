import { useLayoutEffect } from 'react'
import { useTheme } from '@/store/theme.store'
import { Theme } from '@/types/themeContext'
import { isDesktop } from '@/utils/desktop'
import { setDesktopTitleBarColors } from '@/utils/theme'

export const appThemes: Theme[] = Object.values(Theme)

export function ThemeObserver() {
  const { theme, zoomPercent } = useTheme()

  useLayoutEffect(() => {
    const root = window.document.documentElement

    root.classList.remove(...appThemes)
    root.classList.add(theme)

    setDesktopTitleBarColors()
  }, [theme])

  useLayoutEffect(() => {
    const zoomFactor = zoomPercent / 100

    if (isDesktop()) {
      window.api.setZoomFactor(zoomFactor)
      return
    }

    window.document.documentElement.style.zoom = zoomFactor.toString()
  }, [zoomPercent])

  return null
}
