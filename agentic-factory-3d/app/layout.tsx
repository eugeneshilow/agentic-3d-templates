import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import type { ReactNode } from 'react'

import './globals.css'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })

// Where the site is deployed: makes the social preview image URL absolute.
// On Vercel the production domain is picked up automatically.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000'

const title = 'Agentic Factory — Interactive 3D Machine'
const description =
  'A short-video factory that AI agents build, as one interactive 3D machine: order, script, video, post, payment. Four modes, five cameras, an embed mode and a postMessage API. Procedural three.js, no models.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: { title, description, type: 'website', images: ['/preview.png'] },
  twitter: { card: 'summary_large_image', title, description, images: ['/preview.png'] },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  viewportFit: 'cover',
}

// `?embed=1` hides the debug panels before the first paint (see README, "Embed it as a hero").
const EMBED_MODE = `if(new URLSearchParams(location.search).get('embed')==='1')document.documentElement.classList.add('embed')`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <Script id="embed-mode" strategy="beforeInteractive">
          {EMBED_MODE}
        </Script>
        {children}
      </body>
    </html>
  )
}
