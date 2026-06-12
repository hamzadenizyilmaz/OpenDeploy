"use client";

import { useEffect } from "react";
import { ActionButton } from "../components/ActionButton";

export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">OpenDeploy</p>
        <h1 className="mt-2 text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          The panel could not render this view. Retry after the API and services are healthy.
        </p>
        <div className="mt-5">
          <ActionButton onClick={reset}>Retry</ActionButton>
        </div>
      </section>
    </main>
  );
}
