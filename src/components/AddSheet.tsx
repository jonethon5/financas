import { useNavigate } from 'react-router'
import { ClipboardPaste, PenLine, ScanLine } from 'lucide-react'
import { useCategories, useMonth, useRecurringBills } from '../data/hooks'
import { onlyDigits } from '../lib/barcode'
import type { YearMonth } from '../lib/dates'
import { monthParam } from '../pages/HomePage'
import { CategoryIcon } from './CategoryIcon'
import { Sheet } from './Sheet'
import { List, Row } from './ui'

/**
 * Menu do "+": o jeito mais curto de lançar.
 *  - escanear com a câmera ou colar o código de barras (o app lê valor e vencimento),
 *  - informar o valor de uma conta fixa que ainda está sem valor,
 *  - ou digitar uma despesa nova.
 */
export function AddSheet({ open, onClose, ym }: { open: boolean; onClose: () => void; ym: YearMonth }) {
  const navigate = useNavigate()
  const month = useMonth(ym)
  const categories = useCategories()
  const recurring = useRecurringBills()
  const q = `?mes=${monthParam(ym)}`
  const closed = month.data?.month.status === 'closed'
  const awaiting = (month.data?.expenses ?? []).filter((e) => e.recurring_bill_id && e.amount_cents == null)

  const go = (to: string, state?: unknown) => {
    onClose()
    navigate(to, { state })
  }

  async function pasteCode() {
    let text = ''
    try {
      text = await navigator.clipboard.readText()
    } catch {
      // Sem permissão para ler: abre o formulário com o campo do código em foco
    }
    const digits = onlyDigits(text)
    const isPix = text.trim().startsWith('000201')
    go(`/lancar${q}`, digits.length >= 44 || isPix ? { barcode: text } : { focusBarcode: true })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Lançar">
      {closed ? (
        <p className="py-6 text-center text-muted">Este mês está fechado. Reabra o mês para lançar.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-2.5">
            <button
              onClick={() => go(`/lancar${q}`, { scan: true })}
              className="shadow-soft flex flex-col items-start gap-5 rounded-[1.25rem] bg-primary p-3.5 text-left text-on-primary transition active:scale-[0.98]"
            >
              <ScanLine className="size-7" strokeWidth={1.8} aria-hidden />
              <span>
                <span className="block text-[1rem] leading-tight font-semibold">Escanear</span>
                <span className="block text-[0.8125rem] text-white/75">com a câmera</span>
              </span>
            </button>
            <button onClick={pasteCode} className="shadow-soft flex flex-col items-start gap-5 rounded-[1.25rem] bg-surface p-3.5 text-left transition active:scale-[0.98]">
              <ClipboardPaste className="size-7 text-ink/80" strokeWidth={1.8} aria-hidden />
              <span>
                <span className="block text-[1rem] leading-tight font-semibold">Colar</span>
                <span className="block text-[0.8125rem] text-muted">código ou Pix</span>
              </span>
            </button>
            <button
              onClick={() => go(`/lancar${q}`)}
              className="shadow-soft flex flex-col items-start gap-5 rounded-[1.25rem] bg-surface p-3.5 text-left transition active:scale-[0.98]"
            >
              <PenLine className="size-7 text-ink/80" strokeWidth={1.8} aria-hidden />
              <span>
                <span className="block text-[1rem] leading-tight font-semibold">Digitar</span>
                <span className="block text-[0.8125rem] text-muted">o valor</span>
              </span>
            </button>
          </div>

          {awaiting.length > 0 && (
            <>
              <p className="mb-2 px-1 text-[0.8125rem] font-medium tracking-wide text-muted uppercase">Contas fixas sem valor</p>
              <List>
                {awaiting.map((e) => (
                  <Row
                    key={e.id}
                    onClick={() => go(`/conta/${e.id}/editar${q}`)}
                    icon={<CategoryIcon category={categories.data?.find((c) => c.id === e.category_id)} />}
                    title={e.description}
                    subtitle={recurring.data?.find((b) => b.id === e.recurring_bill_id)?.provider ?? undefined}
                    trailing={<span className="text-[0.9375rem] font-medium text-primary">Informar valor</span>}
                  />
                ))}
              </List>
            </>
          )}

          <p className="mt-5 px-1 text-[0.875rem] text-muted">
            Escaneie o código de barras da conta de papel, ou copie a linha digitável do e-mail ou do app e toque em “Colar”.
          </p>
        </>
      )}
    </Sheet>
  )
}
