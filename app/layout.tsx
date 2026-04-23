import type { Metadata, Viewport } from 'next';
import { SessionProvider } from 'next-auth/react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Finanzplanner - Dein Finanz-Assistent',
  description: 'Dein persönlicher Finanzplanner - Verwalte Einnahmen, Ausgaben, Schulden und Sparziele',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Finanzplanner',
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💰</text></svg>",
    apple: '/icons/icon-192.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#2563eb',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const theme = localStorage.getItem('theme') || 'system';
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
            document.documentElement.classList.toggle('dark', resolved === 'dark');
            document.documentElement.dataset.theme = resolved;
            document.documentElement.style.colorScheme = resolved;
          } catch {}
        ` }} />
      </head>
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
        ` }} />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
