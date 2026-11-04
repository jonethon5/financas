import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** Painel que sobe de baixo (como as folhas do iPhone). */
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
      className="sheet m-0 mx-auto mt-auto max-h-[92dvh] w-full max-w-[30rem] rounded-t-[1.75rem] bg-bg p-0 text-ink backdrop:bg-black/35"
    >
      <div className="sticky top-0 z-10 bg-bg/90 px-4 pt-2 pb-3 backdrop-blur-xl">
        <div className="mx-auto mb-2 h-[5px] w-9 rounded-full bg-black/15" aria-hidden />
        <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center">
          <span />
          <h2 className="text-center text-[1.0625rem] font-semibold">{title}</h2>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-full bg-black/[0.06] text-muted outline-none" aria-label="Fechar">
            <X className="size-[1.125rem]" strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      </div>
      <div className="pb-safe px-4 pt-1 pb-6">{children}</div>
    </dialog>
  )
}
