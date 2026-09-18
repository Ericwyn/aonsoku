import { ColorSettings } from './colors'
import { FullscreenSettings } from './fullscreen'
import { ThemeSettingsPicker } from './theme'
import { ZoomSettings } from './zoom'

export function Appearance() {
  return (
    <div className="space-y-4">
      <FullscreenSettings />
      <ZoomSettings />
      <ColorSettings />
      <ThemeSettingsPicker />
    </div>
  )
}
