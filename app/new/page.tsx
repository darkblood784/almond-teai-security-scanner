'use client';
import ScanForm from '@/components/ScanForm';
import { useLanguage } from '@/contexts/LanguageContext';
import { strings } from '@/lib/i18n';

export default function NewScanPage() {
  const { lang } = useLanguage();
  const t = strings[lang];

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-gray-900 text-white">
          <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
            <path d="M12 2L3.5 5.5V12c0 5 3.5 9.5 8.5 11 5-1.5 8.5-6 8.5-11V5.5L12 2z"
              stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
            <path d="M8.5 12l2.5 2.5 4.5-5"
              stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{t.new_title}</h1>
        <p className="mt-2 text-sm text-gray-400">{t.new_sub}</p>
      </div>

      <ScanForm />

      <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-gray-400">
        {['🔒 Code not stored', '⚡ Results in 30s', '📄 Free PDF report'].map(item => (
          <div key={item} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            {item}
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-gray-300">
        * Scores are for reference only and do not guarantee your product won&apos;t be hacked
      </p>
    </div>
  );
}
