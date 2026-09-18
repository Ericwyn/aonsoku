import { useTranslation } from 'react-i18next'
import {
  Content,
  ContentItem,
  ContentItemForm,
  ContentItemTitle,
  ContentSeparator,
  Header,
  HeaderDescription,
  HeaderTitle,
  Root,
} from '@/app/components/settings/section'
import { Slider } from '@/app/components/ui/slider'
import { useTheme } from '@/store/theme.store'
import { ZOOM_PRESETS } from '@/utils/zoom'

export function ZoomSettings() {
  const { t } = useTranslation()
  const { zoomPercent, setZoomPercent } = useTheme()
  const zoomIndex = ZOOM_PRESETS.indexOf(
    zoomPercent as (typeof ZOOM_PRESETS)[number],
  )

  return (
    <Root>
      <Header>
        <HeaderTitle>{t('settings.appearance.zoom.group')}</HeaderTitle>
        <HeaderDescription>
          {t('settings.appearance.zoom.description')}
        </HeaderDescription>
      </Header>
      <Content>
        <ContentItem>
          <ContentItemTitle info={t('settings.appearance.zoom.info')}>
            {t('settings.appearance.zoom.label')}
          </ContentItemTitle>
          <ContentItemForm className="gap-3">
            <Slider
              value={[zoomIndex]}
              min={0}
              max={ZOOM_PRESETS.length - 1}
              step={1}
              tooltipValue={`${zoomPercent}%`}
              onValueChange={([index]) =>
                setZoomPercent(ZOOM_PRESETS[index] ?? 100)
              }
              aria-label={t('settings.appearance.zoom.label')}
            />
            <span className="w-12 text-right text-sm tabular-nums">
              {zoomPercent}%
            </span>
          </ContentItemForm>
        </ContentItem>
      </Content>
      <ContentSeparator />
    </Root>
  )
}
