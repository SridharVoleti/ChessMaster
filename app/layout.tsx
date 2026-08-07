import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ChessQuest',
  description: 'Learn chess tactics through guided games',
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
