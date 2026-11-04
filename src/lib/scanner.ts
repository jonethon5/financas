// Leitor de código de barras (boleto, contas de consumo) e QR Code (Pix).
// Usa o leitor do próprio sistema quando existe (Android); no iPhone carrega o ZXing (WebAssembly)
// só quando a câmera é aberta, servido pelo próprio app.

export type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]> }

const FORMATS = ['itf', 'qr_code']

type NativeDetectorClass = {
  new (options: { formats: string[] }): Detector
  getSupportedFormats(): Promise<string[]>
}

export async function createDetector(): Promise<Detector> {
  const Native = (window as unknown as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats()
      if (FORMATS.every((f) => supported.includes(f))) return new Native({ formats: FORMATS })
    } catch {
      // usa o ZXing
    }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  })
  return new BarcodeDetector({ formats: ['itf', 'qr_code'] })
}
