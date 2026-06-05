import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'THE ELDER · Myth Diviner',
  description:
    'The Elder reveals the myth living through your life. A consciousness transformation project of the Temporal Bridges Institute and AHAU AI.',
  authors: [{ name: 'Temporal Bridges Institute' }],
  openGraph: {
    title: 'THE ELDER · Myth Diviner',
    description: 'You did not choose your myth. Your myth chose you.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0a0806',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
