import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** Painel que sobe de baixo no celular e vira janela central no desktop. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl bg-surface p-0 text-ink backdrop:bg-slate-950/50 md:m-auto md:max-w-lg md:rounded-3xl"
    >
      <div className="sticky top-0 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button onClick={onClose} className="grid size-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Fechar">
          <X className="size-6" aria-hidden />
        </button>
      </div>
      <div className="pb-safe p-5">{children}</div>
    </dialog>
  )
}
