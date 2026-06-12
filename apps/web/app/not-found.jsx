import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">The requested OpenDeploy page does not exist.</p>
        <Link className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-950" href="/dashboard">
          Go to dashboard
        </Link>
      </section>
    </main>
  );
}
