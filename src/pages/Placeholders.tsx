import { MessageCircleQuestion } from 'lucide-react'
import { Card, EmptyState, PageHeader } from '../components/ui'

export function AskPage() {
  return (
    <>
      <PageHeader title="Perguntar" subtitle="Tire dúvidas sobre as contas da casa" />
      <Card>
        <EmptyState icon={<MessageCircleQuestion className="size-8" />} title="Assistente em breve">
          Aqui você vai poder perguntar coisas como “Quanto gastamos de luz nos últimos 3 meses?” ou “Quanto a Karen ainda deve?”.
        </EmptyState>
      </Card>
    </>
  )
}
