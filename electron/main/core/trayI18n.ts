import i18next from 'i18next'
import { resources } from '../../../src/i18n/languages'
import { AonsokuStore } from './store'

interface LanguageSettings {
  language: string
}

const languageStore = new AonsokuStore<LanguageSettings>({
  name: 'language',
  defaults: {
    language: 'en-US',
  },
})

const trayI18n = i18next.createInstance()

trayI18n.init({
  initImmediate: false,
  fallbackLng: 'en-US',
  lng: languageStore.get('language'),
  resources,
})

export function getTrayTranslation(key: string) {
  return trayI18n.t(`tray.${key}`)
}

export async function setTrayLanguage(language: string) {
  languageStore.set('language', language)
  await trayI18n.changeLanguage(language)
}
