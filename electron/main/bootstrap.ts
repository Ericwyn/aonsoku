import { app } from 'electron'
import { productName } from '../../package.json'

app.setName(productName)

const userDataDir = process.env.AONSOKU_USER_DATA_DIR
if (userDataDir) {
  app.setPath('userData', userDataDir)
}

await import('./index')
