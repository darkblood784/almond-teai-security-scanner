import Link from 'next/link';

export default function ProjectVerificationNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 card-shadow">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          Almond teAI Verification
        </p>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">Verification page not available</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">
          This project was not found or is not publicly visible.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
        >
          Back to Almond teAI
        </Link>
      </div>
    </div>
  );
}
