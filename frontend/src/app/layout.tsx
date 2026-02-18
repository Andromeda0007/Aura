import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Aura - AI-Powered Teaching Assistant',
  description: 'Transform your smartboard lectures with real-time AI assistance. Generate quizzes, summaries, and interactive content instantly.',
  keywords: ['AI', 'teaching', 'education', 'smartboard', 'whiteboard', 'assistant'],
  authors: [{ name: 'Aura Team' }],
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#1B1B1F',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-dark-900 font-sans">
        {children}
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#202127',
              color: '#DFDFD6',
              borderRadius: '12px',
              border: '1px solid #3b3b32',
              padding: '16px',
              boxShadow: '0 4px 25px -5px rgba(0, 0, 0, 0.3)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#1B1B1F',
              },
            },
            error: {
              iconTheme: {
                primary: '#dc2626',
                secondary: '#1B1B1F',
              },
            },
          }}
        />
      </body>
    </html>
  )
}
