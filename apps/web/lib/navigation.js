import {
  Activity,
  Archive,
  Bot,
  Boxes,
  Building2,
  Clock3,
  Database,
  FileText,
  Flame,
  Gauge,
  Globe,
  Home,
  KeyRound,
  Layers,
  Lock,
  Network,
  Scale,
  ScrollText,
  Server,
  Settings,
  Shield,
  Terminal,
  UploadCloud,
  Users,
  Wrench
} from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home }
];

export const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/monitoring", label: "Monitoring", icon: Activity },
      { href: "/logs", label: "Logs", icon: ScrollText }
    ]
  },
  {
    label: "Deploy",
    items: [
      { href: "/projects", label: "Projects", icon: Boxes },
      { href: "/deployments", label: "Deployments", icon: UploadCloud },
      { href: "/pm2", label: "PM2 Manager", icon: Wrench },
      { href: "/services", label: "Services", icon: Server }
    ]
  },
  {
    label: "Data",
    items: [
      { href: "/databases", label: "Databases", icon: Database },
      { href: "/database-browser", label: "Database Browser", icon: Layers },
      { href: "/sql-console", label: "SQL Console", icon: Terminal },
      { href: "/redis-browser", label: "Redis Browser", icon: Database },
      { href: "/backups", label: "Backups", icon: Archive }
    ]
  },
  {
    label: "Network",
    items: [
      { href: "/domains", label: "Domains", icon: Globe },
      { href: "/dns", label: "DNS Manager", icon: Network },
      { href: "/ssl", label: "SSL Certificates", icon: Lock },
      { href: "/proxy", label: "Nginx / Apache", icon: Server },
      { href: "/firewall", label: "Firewall", icon: Flame },
      { href: "/ports", label: "Ports", icon: Network }
    ]
  },
  {
    label: "Security",
    items: [
      { href: "/security/waf-rules", label: "WAF Rules", icon: Shield },
      { href: "/security/advanced-rules", label: "Advanced Rules", icon: Shield },
      { href: "/security/rate-limiting", label: "Rate Limiting", icon: Gauge },
      { href: "/security/challenge-settings", label: "Challenge Settings", icon: Bot }
    ]
  },
  {
    label: "Access",
    items: [
      { href: "/files", label: "File Manager", icon: FileText },
      { href: "/terminal", label: "Terminal", icon: Terminal },
      { href: "/api-keys", label: "API Keys", icon: KeyRound },
      { href: "/api-docs", label: "API Docs", icon: FileText },
      { href: "/users", label: "Users", icon: Users },
      { href: "/roles", label: "Roles", icon: KeyRound },
      { href: "/audit", label: "Audit Logs", icon: Shield },
      { href: "/compliance", label: "Compliance", icon: Scale },
      { href: "/enterprise", label: "Enterprise Ops", icon: Building2 }
    ]
  },
  {
    label: "System",
    items: [
      { href: "/cron", label: "Auto Cron", icon: Clock3 },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/update", label: "Server Update", icon: UploadCloud }
    ]
  }
];

export const flatNavItems = navSections.flatMap((section) =>
  section.items.map((item) => ({ ...item, section: section.label }))
);
