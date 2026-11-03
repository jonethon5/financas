import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Gera os ícones do PWA (favicon, apple-touch, maskable) a partir de public/logo.svg no build.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#4A90A4' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#4A90A4' } },
  },
  images: ['public/logo.svg'],
})
