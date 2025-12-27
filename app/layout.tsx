import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ravi Status Analyzer',
  description: 'Analyze PDF books to find Ravi status references',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
