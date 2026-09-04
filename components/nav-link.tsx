"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm", active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
      {icon}<span className="max-w-20 truncate sm:max-w-32">{children}</span>
    </Link>
  );
}
