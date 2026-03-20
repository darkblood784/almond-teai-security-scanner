import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import AppSessionProvider from '@/components/SessionProvider';
import { LanguageProvider } from '@/contexts/LanguageContext';

export const metadata: Metadata = {
  title:       'Almond teAI - Security Verification Before You Ship',
  description: 'Evidence-driven security verification for repositories and websites. Get trust scoring, finding context, and shareable verification reports.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
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
