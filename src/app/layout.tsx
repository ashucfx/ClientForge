import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Catalyst TPA · ClientForge',
  description: 'Client operations and financial management platform for Catalyst TPA.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/logos/catalyst-favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/logos/catalyst-favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="dark">
        {children}
      </body>
    </html>
  );
}
