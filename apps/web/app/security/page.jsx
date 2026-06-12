"use client";

import Link from "next/link";
import { Bot, Gauge, Shield } from "lucide-react";
import { Shell } from "../../components/Shell";
import { PageHeader } from "../../components/PageHeader";

const pages = [
  { href: "/security/waf-rules", label: "WAF Rules", icon: Shield, description: "Application firewall policies for XSS, SQLi, upload abuse and admin surfaces." },
  { href: "/security/advanced-rules", label: "Advanced Rules", icon: Shield, description: "Bot scoring, request smuggling, header sanitizer and path normalization." },
  { href: "/security/rate-limiting", label: "Rate Limiting", icon: Gauge, description: "Login, API, DNS, terminal and SQL throttling profiles." },
  { href: "/security/challenge-settings", label: "Challenge Settings", icon: Bot, description: "Managed challenge provider, protected routes and risky action controls." }
];

export default function SecurityIndexPage() {
  return (
    <Shell>
      <PageHeader title="Security" description="Manage WAF, advanced rules, rate limiting and challenge policies from dedicated control surfaces." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {pages.map((page) => {
          const Icon = page.icon;
          return (
            <Link key={page.href} href={page.href} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
              <Icon className="h-5 w-5 text-slate-400" />
              <div className="mt-3 font-semibold">{page.label}</div>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{page.description}</div>
            </Link>
          );
        })}
      </div>
    </Shell>
  );
}
