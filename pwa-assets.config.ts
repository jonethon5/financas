import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Gera os ícones do PWA (favicon, apple-touch, maskable) a partir de public/logo.svg no build.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0B0B0C' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0B0B0C' } },
  },
  images: ['public/logo.svg'],
})
