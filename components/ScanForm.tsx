'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Github, Upload, Scan, Loader2, AlertCircle, FolderOpen, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { strings } from '@/lib/i18n';

type Tab = 'github' | 'website' | 'upload';

export default function ScanForm() {
  const router = useRouter();
  const { lang } = useLanguage();
  const t = strings[lang];

  const [tab,     setTab]     = useState<Tab>('github');
  const [url,     setUrl]     = useState('');
  const [webUrl,  setWebUrl]  = useState('');
  const [file,    setFile]    = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [drag,    setDrag]    = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith('.zip')) { setFile(dropped); setError(''); }
    else setError(t.form_err_format);
  };

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      let res: Response;

      if (tab === 'website') {
        if (!webUrl.trim()) { setError(t.form_website_err); setLoading(false); return; }
        let normalized = webUrl.trim();
        if (!normalized.startsWith('http')) normalized = `https://${normalized}`;
        try { new URL(normalized); } catch { setError(t.form_website_err); setLoading(false); return; }
        res = await fetch('/api/analyze', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalized, scanType: 'website' }),
        });
      } else if (tab === 'github') {
        if (!url.trim()) { setError(t.form_err_url); setLoading(false); return; }
        res = await fetch('/api/analyze', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url.trim() }),
        });
      } else {
        if (!file) { setError(t.form_err_file); setLoading(false); return; }
        const form = new FormData();
        form.append('file', file);
        res = await fetch('/api/analyze', { method: 'POST', body: form });
      }

      const data = await res.json() as { scanId?: string; error?: string };
      if (!res.ok || !data.scanId) { setError(data.error ?? t.form_err_server); setLoading(false); return; }
      router.push(`/scan/${data.scanId}`);
    } catch {
      setError(t.form_err_network);
      setLoading(false);
    }
  };

  const tabs: { key: Tab; icon: React.ElementType; label: string }[] = [
    { key: 'github',  icon: Github, label: t.form_tab_github  },
    { key: 'website', icon: Globe,  label: t.form_tab_website },
    { key: 'upload',  icon: Upload, label: t.form_tab_upload  },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 card-shadow">

      {/* Tab switcher */}
      <div className="mb-8 flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button key={key}
            onClick={() => { setTab(key); setError(''); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold transition-all"
            style={tab === key
              ? { backgroundColor: '#ffffff', color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: '#6B7280' }
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* GitHub URL */}
      {tab === 'github' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">{t.form_github_label}</label>
          <input
            type="url"
            placeholder={t.form_github_placeholder}
            value={url}
            onChange={e => { setUrl(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-colors"
          />
          <p className="text-xs text-gray-400">
            {t.form_github_hint}
            <code className="font-mono text-gray-600">GITHUB_TOKEN</code>.
          </p>
        </div>
      )}

      {/* Website URL */}
      {tab === 'website' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">{t.form_website_label}</label>
          <input
            type="url"
            placeholder={t.form_website_placeholder}
            value={webUrl}
            onChange={e => { setWebUrl(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 transition-colors"
          />
          <p className="text-xs text-gray-400">{t.form_website_hint}</p>

          {/* What we check */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {[
              { icon: '🔒', label: 'HTTPS & HSTS' },
              { icon: '🛡️', label: 'Security Headers' },
              { icon: '🍪', label: 'Cookie Flags' },
              { icon: '📂', label: 'Exposed Files (.env, .git…)' },
              { icon: '🔗', label: 'CORS Config' },
              { icon: '📡', label: 'Info Leakage' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ZIP Upload */}
      {tab === 'upload' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">{t.form_zip_label}</label>
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 transition-all"
            style={drag
              ? { borderColor: '#111827', backgroundColor: '#F9FAFB' }
              : file
              ? { borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' }
              : { borderColor: '#E5E7EB' }
            }
          >
            <input ref={fileRef} type="file" accept=".zip" className="hidden"
              onChange={e => { if (e.target.files?.[0]) { setFile(e.target.files[0]); setError(''); } }} />
            {file ? (
              <>
                <FolderOpen className="h-10 w-10 text-gray-400" />
                <div className="text-center">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <p className="text-xs text-gray-400">{t.form_zip_change}</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-gray-300" />
                <div className="text-center">
                  <p className="font-medium text-gray-600">{t.form_zip_drag}</p>
                  <p className="text-sm text-gray-400">{t.form_zip_click}</p>
                </div>
              </>
            )}
          </div>
          <p className="text-xs text-gray-400">{t.form_zip_hint}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={submit}
        disabled={loading}
        className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg bg-gray-900 px-6 py-4 font-semibold text-white text-base transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? <><Loader2 className="h-5 w-5 animate-spin" />{t.form_scanning}</>
          : tab === 'website'
          ? <><Globe className="h-5 w-5" />{t.form_submit}</>
          : <><Scan className="h-5 w-5" />{t.form_submit}</>
        }
      </button>
    </div>
  );
}
