import type { Metadata } from 'next';
import { Inter, Cinzel } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const cinzel = Cinzel({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-cinzel' });

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
      <body className={`${inter.className} ${cinzel.variable} dark`}>
        {children}
      </body>
    </html>
  );
}
