'use client';

import Link from 'next/link';
import { LayoutDashboard, Plus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { strings } from '@/lib/i18n';

function ShieldLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M12 2L3.5 5.5V12c0 5 3.5 9.5 8.5 11 5-1.5 8.5-6 8.5-11V5.5L12 2z"
        stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
      />
      <path
        d="M8.5 12l2.5 2.5 4.5-5"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { lang, toggle } = useLanguage();
  const t = strings[lang];

  const links = [
    { href: '/dashboard', label: t.nav_dashboard, icon: LayoutDashboard },
    { href: '/new', label: t.nav_newScan, icon: Plus },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white transition-colors group-hover:bg-gray-700">
            <ShieldLogo className="h-5 w-5" />
          </div>
          <span className="text-base font-bold tracking-tight text-gray-900">
            Almond te<span className="text-gray-400">AI</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}

          <button
            onClick={toggle}
            className="ml-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-900"
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>

          {status === 'authenticated' ? (
            <>
              <span className="ml-2 hidden text-sm text-gray-400 sm:inline">
                {session.user.name ?? session.user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="ml-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-900"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn('github')}
              className="ml-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
