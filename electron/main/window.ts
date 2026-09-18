import { is, platform } from '@electron-toolkit/utils'
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electron } from '../../package.json'
import { colorsState } from './core/colors'
import { updateDockMenu } from './core/dockMenu'
import { setupDownloads } from './core/downloads'
import { setupEvents, setupIpcEvents } from './core/events'
import { appIcon } from './core/icon'
import { playerState } from './core/playerState'
import { titleBarOverlay } from './core/titleBarOverlay'
import { setUpdaterWindow } from './core/updater'
import { StatefulBrowserWindow } from './core/windowPosition'
import { createTray } from './tray'

export let mainWindow: BrowserWindow | null = null

const { defaultWidth, defaultHeight, defaultBgColor } = electron.window

export function createWindow(): void {
  const backgroundColor = colorsState.get('bgColor') ?? defaultBgColor

  mainWindow = new StatefulBrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    minWidth: defaultWidth,
    minHeight: defaultHeight,
    backgroundColor,
    supportMaximize: true,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    visualEffectState: 'followWindow',
    roundedCorners: true,
    frame: false,
    ...(platform.isWindows ? { titleBarOverlay } : {}),
    trafficLightPosition: { x: 15, y: 14 },
    icon: appIcon(),
    webPreferences: {
      preload: join(app.getAppPath(), 'out/preload/index.mjs'),
      sandbox: false,
    },
  })

  // set initial state
  playerState.setAll({
    isPlaying: false,
    hasSonglist: false,
    hasPrevious: false,
    hasNext: false,
  })

  createTray()
  updateDockMenu()
  setupEvents(mainWindow)
  setupIpcEvents(mainWindow)
  setupDownloads(mainWindow)
  setUpdaterWindow(mainWindow)

  // Keep the renderer on file:// in development so it shares the installed
  // application's localStorage and IndexedDB. The dev shell imports the Vite
  // modules over HTTP, which still preserves HMR.
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadFile(join(app.getAppPath(), 'electron/dev-renderer.html'), {
      query: {
        server: process.env.ELECTRON_RENDERER_URL,
        debugLyrics: process.env.AONSOKU_DEBUG_LYRICS ?? '',
      },
      hash: '/',
    })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'), {
      hash: '/',
    })
  }
}
