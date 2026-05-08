import type { Metadata } from 'next';
import { Providers } from '@/components/auth/Providers';
import { RegisterServiceWorker } from '@/components/pwa/RegisterServiceWorker';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';
import './globals.css';

export const metadata: Metadata = {
  title: 'NAYCA 2026 Scheduling Sheet',
  description: 'Securely view and edit NAYCA 2026 Scheduling Google Sheets.',
  icons: [
    {
      rel: 'icon',
      url: '/favicon.png',
      type: 'image/png',
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="theme-color" content="#1f2937" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <RegisterServiceWorker />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
