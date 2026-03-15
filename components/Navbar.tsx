'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LayoutDashboard, Plus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { strings } from '@/lib/i18n';

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
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-transform group-hover:scale-[1.02]">
            <Image
              src="/branding/logo-mark.svg"
              alt="Almond teAI"
              width={40}
              height={40}
              className="h-10 w-10"
              priority
            />
          </div>

          <span className="block truncate text-sm font-bold tracking-tight text-slate-900 sm:text-base">
            Almond teAI
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors sm:px-3',
                pathname === href
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}

          <button
            onClick={toggle}
            className="ml-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-900 sm:ml-2 sm:px-3"
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
