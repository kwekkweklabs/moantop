import { createFileRoute } from '@tanstack/react-router'
import MoanMac from '@/components/MoanMac'

export const Route = createFileRoute('/')({
  component: IndexPage,
  head: () => ({
    meta: [
      { title: 'Moan Mac' },
      { name: 'description', content: 'Smack it. It moans.' },
    ],
  }),
})

function IndexPage() {
  return <MoanMac />
}
