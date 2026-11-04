import { useEffect, useRef, useState } from 'react'
import { Flashlight, FlashlightOff, Loader2 } from 'lucide-react'
import { classifyScan, type ScanResult } from '../lib/scan'
import { createDetector } from '../lib/scanner'

/**
 * Câmera em tela cheia que lê o código de barras da conta ou o QR Code do Pix.
 * Para assim que encontra um código válido (com os dígitos verificadores conferidos).
 */
export function Scanner({
  onResult,
  onClose,
  onManual,
}: {
  onResult: (result: ScanResult) => void
  onClose: () => void
  /** "Digitar o código": aparece se a câmera demorar para ler */
  onManual: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const track = useRef<MediaStreamTrack | null>(null)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [error, setError] = useState('')
  const [torch, setTorch] = useState<boolean | null>(null)
  const [slow, setSlow] = useState(false)
  const done = useRef(onResult)
  done.current = onResult

  useEffect(() => {
    if (status !== 'scanning') return
    const t = setTimeout(() => setSlow(true), 10_000)
    return () => clearTimeout(t)
  }, [status])

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout>
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
        const [s, detector] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            audio: false,
            // Resolução alta: com o celular em pé, o código de barras longo do boleto precisa de pixels na largura
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
          }),
          createDetector(),
        ])
        stream = s
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        const t = s.getVideoTracks()[0]
        track.current = t
        // Lanterna: só alguns celulares (Android) deixam o navegador ligar
        if ((t.getCapabilities?.() as { torch?: boolean } | undefined)?.torch) setTorch(false)
        const el = video.current!
        el.srcObject = s
        await el.play()
        setStatus('scanning')

        // Lê só a faixa do meio da imagem (onde fica o quadro): mais rápido e mais preciso
        const tick = async () => {
          if (stopped) return
          const w = el.videoWidth
          const h = el.videoHeight
          if (w && h && ctx) {
            const cw = Math.round(w * 0.92)
            const ch = Math.round(Math.min(h * 0.6, cw * 0.6))
            canvas.width = cw
            canvas.height = ch
            ctx.drawImage(el, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, cw, ch)
            try {
              for (const code of await detector.detect(canvas)) {
                const result = classifyScan(code.rawValue)
                if (result && !stopped) {
                  stopped = true
                  navigator.vibrate?.(60)
                  done.current(result)
                  return
                }
              }
            } catch {
              // quadro ruim: tenta o próximo
            }
          }
          timer = setTimeout(tick, 120)
        }
        tick()
      } catch (err) {
        if (stopped) return
        const name = (err as Error).name
        setError(
          name === 'NotAllowedError'
            ? 'O app não tem permissão para usar a câmera. Libere a câmera nas configurações do celular e tente de novo.'
            : name === 'NotFoundError' || (err as Error).message === 'unsupported'
              ? 'Não encontramos uma câmera neste aparelho.'
              : 'Não foi possível abrir a câmera. Tente de novo ou cole o código.',
        )
        setStatus('error')
      }
    }

    start()
    return () => {
      stopped = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function toggleTorch() {
    const next = !torch
    try {
      await track.current?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      setTorch(next)
    } catch {
      setTorch(null)
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Escanear código" className="fixed inset-0 z-50 bg-black text-white">
      <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" />

      {/* Quadro de mira: escurece o resto da tela */}
      {status !== 'error' && (
        <div className="absolute inset-0 grid place-items-center px-5">
          <div className="relative aspect-[2.6/1] w-full max-w-md rounded-[1.25rem] shadow-[0_0_0_100vmax_rgb(0_0_0/0.55)]">
            <span className="absolute -top-0.5 -left-0.5 size-8 rounded-tl-[1.25rem] border-t-4 border-l-4 border-white" />
            <span className="absolute -top-0.5 -right-0.5 size-8 rounded-tr-[1.25rem] border-t-4 border-r-4 border-white" />
            <span className="absolute -bottom-0.5 -left-0.5 size-8 rounded-bl-[1.25rem] border-b-4 border-l-4 border-white" />
            <span className="absolute -right-0.5 -bottom-0.5 size-8 rounded-br-[1.25rem] border-r-4 border-b-4 border-white" />
            {status === 'scanning' && <span className="animate-scanline absolute inset-x-4 h-0.5 rounded-full bg-[#7fd0e4] shadow-[0_0_12px_#7fd0e4]" />}
          </div>
        </div>
      )}

      <div className="pt-safe absolute inset-x-0 top-0">
        <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center px-4">
          <button onClick={onClose} className="justify-self-start text-[1.0625rem] active:opacity-50">
            Cancelar
          </button>
          <p className="text-[1.0625rem] font-semibold">Escanear</p>
          {torch !== null ? (
            <button
              onClick={toggleTorch}
              aria-label={torch ? 'Desligar lanterna' : 'Ligar lanterna'}
              className={`grid size-9 place-items-center justify-self-end rounded-full ${torch ? 'bg-white text-black' : 'bg-white/20'}`}
            >
              {torch ? <Flashlight className="size-5" aria-hidden /> : <FlashlightOff className="size-5" aria-hidden />}
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>

      <div className="pb-safe absolute inset-x-0 bottom-0 px-6 pb-10 text-center">
        {status === 'error' ? (
          <div className="mx-auto max-w-sm">
            <p className="text-[1.0625rem]">{error}</p>
            <button onClick={onClose} className="mt-5 min-h-[3.25rem] w-full rounded-[0.875rem] bg-white font-semibold text-black">
              Voltar
            </button>
          </div>
        ) : (
          <>
            {status === 'starting' && <Loader2 className="mx-auto mb-3 size-6 animate-spin" aria-hidden />}
            <p className="text-[1.0625rem] font-medium">Aponte para o código de barras ou para o QR Code do Pix</p>
            <p className="mt-1 text-[0.875rem] text-white/70">Aproxime até o código encher o quadro, com boa luz.</p>
            {slow && (
              <button onClick={onManual} className="mt-5 min-h-12 rounded-full bg-white/20 px-6 text-[0.9375rem] font-medium backdrop-blur-xl active:bg-white/30">
                Não está lendo? Digitar o código
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
