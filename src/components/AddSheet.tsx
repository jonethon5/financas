import { useNavigate } from 'react-router'
import { ClipboardPaste, PenLine, ScanBarcode } from 'lucide-react'
import { useCategories, useMonth, useRecurringBills } from '../data/hooks'
import { onlyDigits } from '../lib/barcode'
import type { YearMonth } from '../lib/dates'
import { monthParam } from '../pages/HomePage'
import { CategoryIcon } from './CategoryIcon'
import { Sheet } from './Sheet'
import { List, Row } from './ui'

/**
 * Menu do "+": o jeito mais curto de lançar.
 *  - colar o código de barras (o app lê valor e vencimento),
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
    go(`/lancar${q}`, digits.length >= 44 ? { barcode: text } : { focusBarcode: true })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Lançar">
      {closed ? (
        <p className="py-6 text-center text-muted">Este mês está fechado. Reabra o mês para lançar.</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3">
            <button onClick={pasteCode} className="shadow-soft flex flex-col items-start gap-6 rounded-[1.25rem] bg-primary p-4 text-left text-on-primary transition active:scale-[0.98]">
              <ScanBarcode className="size-7" strokeWidth={1.8} aria-hidden />
              <span>
                <span className="block text-[1.0625rem] leading-tight font-semibold">Colar código</span>
                <span className="block text-[0.875rem] text-white/75">de barras ou Pix</span>
              </span>
            </button>
            <button
              onClick={() => go(`/lancar${q}`)}
              className="shadow-soft flex flex-col items-start gap-6 rounded-[1.25rem] bg-surface p-4 text-left transition active:scale-[0.98]"
            >
              <PenLine className="size-7 text-ink/80" strokeWidth={1.8} aria-hidden />
              <span>
                <span className="block text-[1.0625rem] leading-tight font-semibold">Digitar</span>
                <span className="block text-[0.875rem] text-muted">compra ou conta</span>
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

          <p className="mt-5 flex items-start gap-2 px-1 text-[0.875rem] text-muted">
            <ClipboardPaste className="mt-0.5 size-4 shrink-0" aria-hidden />
            Copie a linha digitável no app do banco ou do e-mail da conta e toque em “Colar código”.
          </p>
        </>
      )}
    </Sheet>
  )
}
