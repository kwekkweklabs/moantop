import { createFileRoute } from '@tanstack/react-router'
import MoanMac from '@/components/MoanMac'

const TITLE = 'MoanTop - Smack Your Laptop, It Moans | Funny Prank Website'
const DESC =
  'Smack your laptop and it moans back. The funniest prank website on the internet. Uses your microphone to detect physical hits. Try it with friends, go viral. Pukul laptop desah, website desahan lucu.'
const URL = 'https://moantop.xyz'
const OG_IMAGE = `${URL}/og.png`

export const Route = createFileRoute('/')({
  component: IndexPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESC },
      { name: 'keywords', content: 'moan website, moaning laptop, prank website, funny website, smack laptop moan, laptop desah, website desahan, pukul laptop, moan prank, viral prank, funny prank online, moantop, moan top' },

      // open graph
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: URL },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESC },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:site_name', content: 'MoanTop' },
      { property: 'og:locale', content: 'en_US' },

      // twitter card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:url', content: URL },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESC },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
  }),
})

function IndexPage() {
  return <MoanMac />
}
