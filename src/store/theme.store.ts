import merge from 'lodash/merge'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createWithEqualityFn } from 'zustand/traditional'
import { IThemeContext, Theme } from '@/types/themeContext'
import { getValidThemeFromEnv } from '@/utils/theme'
import { normalizeZoomPercent } from '@/utils/zoom'

const appThemeFromEnv = getValidThemeFromEnv()

export const useThemeStore = createWithEqualityFn<IThemeContext>()(
  subscribeWithSelector(
    persist(
      devtools(
        immer((set) => ({
          theme: appThemeFromEnv || Theme.Dark,
          setTheme: (theme: Theme) => {
            set((state) => {
              state.theme = theme
            })
          },
          zoomPercent: 100,
          setZoomPercent: (value: number) => {
            set((state) => {
              state.zoomPercent = normalizeZoomPercent(value)
            })
          },
        })),
        {
          name: 'theme_store',
        },
      ),
      {
        name: 'theme_store',
        version: 1,
        merge: (persistedState, currentState) => {
          if (appThemeFromEnv) {
            if (persistedState && typeof persistedState === 'object') {
              persistedState = {
                ...persistedState,
                theme: appThemeFromEnv,
              }
            }
          }

          const merged = merge(currentState, persistedState)
          merged.zoomPercent = normalizeZoomPercent(merged.zoomPercent)

          return merged
        },
      },
    ),
  ),
)

export const useTheme = () => useThemeStore((state) => state)
