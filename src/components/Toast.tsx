import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'

const ToastContext = createContext<(message: string) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

/** Avisos rápidos no rodapé ("Código copiado", "Conta salva"…). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const show = useCallback((text: string) => {
    clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(null), 2400)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
        {message && (
          <div className="animate-toast absolute bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1/2 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-ink/90 px-5 py-3 text-[0.9375rem] font-medium text-white shadow-lg backdrop-blur-xl">
            <CheckCircle2 className="size-5 shrink-0 text-[#5fd39b]" aria-hidden />
            {message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

/** Copia texto para a área de transferência (com plano B para navegadores antigos). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  }
}
