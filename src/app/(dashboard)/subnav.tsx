"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileSearch, Settings } from "lucide-react";

export default function SubNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Overview", matchExact: true },
    { href: "/dashboard/new", icon: FileSearch, label: "Run Insight", matchExact: false },
    { href: "/link-accounts", icon: Settings, label: "Integrations", matchExact: false },
  ];

  return (
    <div className="w-full border-b border-white/5 bg-black/40">
      <div className="max-w-7xl mx-auto px-6 flex items-center gap-6 overflow-x-auto scrollbar-none">
        {navItems.map((item) => {
          const isActive = item.matchExact 
            ? pathname === item.href 
            : pathname.startsWith(item.href);

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive 
                  ? "border-white text-white" 
                  : "border-transparent text-white/50 hover:text-white/80 hover:border-white/30"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
