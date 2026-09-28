import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'

import './globals.css'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })

// Where the site is deployed: makes the social preview image URL absolute.
// On Vercel the production domain is picked up automatically.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000'

const title = 'V8 — Anatomy of Power'
const description =
  'An interactive 3D V8 engine: cutaway, exploded and single-cylinder views, firing order, live valve timing and cylinder pressure. Fully procedural three.js, no models.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: { title, description, type: 'website', images: ['/preview.png'] },
  twitter: { card: 'summary_large_image', title, description, images: ['/preview.png'] },
}

export const viewport: Viewport = {
  themeColor: '#101113',
  colorScheme: 'dark',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
