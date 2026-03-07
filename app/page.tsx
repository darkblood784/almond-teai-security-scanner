'use client';
import Link from 'next/link';
import { ArrowRight, Zap, FileSearch, Award, Lock, Code2, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { strings } from '@/lib/i18n';

const vulnTypes = [
  { label: 'AWS / OpenAI API Key Hardcoded', severity: 'critical', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { label: 'SQL Injection',                  severity: 'critical', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { label: 'DB Credentials Hardcoded',       severity: 'critical', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { label: 'eval() Dangerous Execution',     severity: 'critical', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { label: 'Unprotected Admin Routes',       severity: 'high',     color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  { label: 'XSS Risk',                       severity: 'high',     color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  { label: 'JWT Weak Algorithm',             severity: 'high',     color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  { label: 'CORS Wildcard',                  severity: 'medium',   color: '#CA8A04', bg: '#FEFCE8', border: '#FEF08A' },
];

export default function LandingPage() {
  const { lang } = useLanguage();
  const t = strings[lang];

  const features = [
    { icon: FileSearch, title: t.f1_title, desc: t.f1_desc },
    { icon: Zap,        title: t.f2_title, desc: t.f2_desc },
    { icon: Award,      title: t.f3_title, desc: t.f3_desc },
    { icon: Lock,       title: t.f4_title, desc: t.f4_desc },
    { icon: Code2,      title: t.f5_title, desc: t.f5_desc },
    { icon: FileText,   title: t.f6_title, desc: t.f6_desc },
  ];

  return (
    <div className="overflow-hidden">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative grid-bg pb-28 pt-24">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white via-transparent to-white" />

        <div className="relative mx-auto max-w-4xl px-6 text-center">

          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-500 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            {t.landing_badge}
          </div>

          {/* Headline */}
          <h1 className="mb-5 text-5xl font-bold leading-tight tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
            {t.landing_h1_1}
            <br />
            <span className="text-gray-400">{t.landing_h1_2}</span>
          </h1>

          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-gray-500">
            {t.landing_sub}
          </p>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/new"
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-gray-700"
            >
              {t.landing_cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dashboard"
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-7 py-3.5 font-semibold text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
            >
              {t.landing_view_dashboard}
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 divide-x divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            {[
              { value: t.landing_stat1v, label: t.landing_stat1l },
              { value: t.landing_stat2v, label: t.landing_stat2l },
              { value: t.landing_stat3v, label: t.landing_stat3l },
            ].map(({ value, label }) => (
              <div key={label} className="py-7 text-center">
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="mt-1 text-sm text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Disclaimer ───────────────────────────────────────── */}
      <section className="border-y border-gray-100 bg-gray-50 py-4">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="text-sm text-gray-400">
            <strong className="text-gray-600">{t.landing_disclaimer_label}</strong>{' '}
            {t.landing_disclaimer}
          </p>
        </div>
      </section>

      {/* ── What we detect ───────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">{t.landing_vulns_h2}</h2>
            <p className="mt-3 text-sm text-gray-400">{t.landing_vulns_sub}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {vulnTypes.map(({ label, severity, color, bg, border }) => (
              <div key={label} className="flex items-start gap-3 rounded-xl border p-4 bg-white"
                style={{ borderColor: border }}>
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color }} />
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-bold uppercase"
                    style={{ color, backgroundColor: bg }}>
                    {severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="border-t border-gray-100 bg-gray-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">{t.landing_features_h2}</h2>
            <p className="mt-3 text-sm text-gray-400">{t.landing_features_sub}</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title}
                className="rounded-xl border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Audit report CTA ─────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-xl px-6 text-center">
          <div className="rounded-xl border border-gray-200 bg-white p-12 card-shadow-md">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="mb-3 text-2xl font-bold text-gray-900">{t.landing_audit_h2}</h2>
            <p className="mb-2 text-sm leading-relaxed text-gray-500">{t.landing_audit_desc}</p>
            <p className="mb-8 text-xs text-gray-300">{t.landing_audit_note}</p>
            <Link href="/new"
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-gray-700"
            >
              {t.landing_audit_cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-300">
        {t.landing_footer}
        <span className="mx-3">·</span>
        {t.landing_footer_disc}
      </footer>
    </div>
  );
}
