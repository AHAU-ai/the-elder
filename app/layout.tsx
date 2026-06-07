import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

/*
  Enhancement 11: OG image metadata
  Enhancement 12: lang="mul" set in <html> via enhancements.ts at runtime
  (Next.js doesn't support dynamic lang in metadata, so we patch it client-side)
*/

export const metadata: Metadata = {
  title: 'THE ELDER · Myth Diviner',
  description: 'The Elder reveals the myth living through your life. A consciousness transformation project of the Temporal Bridges Institute and AHAU AI.',
  authors: [{ name: 'Temporal Bridges Institute' }],
  robots: 'index, follow',
  openGraph: {
    title: 'THE ELDER · Myth Diviner',
    description: 'You did not choose your myth. Your myth chose you.',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'THE ELDER — Myth Diviner. You did not choose your myth. Your myth chose you.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'THE ELDER · Myth Diviner',
    description: 'You did not choose your myth. Your myth chose you.',
    images: ['/og-image.png'],
  },
  themeColor: '#0a0806',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mul">
      <head>
        {/* Enhancement 11: Preload fonts for breath gate */}
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Enhancement 11: OG image preload */}
        <link rel="preload" as="image" href="/og-image.png" />
      </head>
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
