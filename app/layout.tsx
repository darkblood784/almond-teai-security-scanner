import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import AppSessionProvider from '@/components/SessionProvider';
import { LanguageProvider } from '@/contexts/LanguageContext';

export const metadata: Metadata = {
  title:       'Almond teAI — Security Review Before You Ship',
  description: 'AI-powered code security scanner. Detect vulnerabilities, get a security score, and download an audit report in under 30 seconds.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-white text-gray-900">
        <AppSessionProvider>
          <LanguageProvider>
            <Navbar />
            <main>{children}</main>
          </LanguageProvider>
        </AppSessionProvider>
      </body>
    </html>
  );
}
