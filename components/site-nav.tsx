import { Spade, Trophy, User } from "lucide-react";
import Link from "next/link";

import { getCurrentUser } from "@/lib/session";

export async function SiteNav() {
  const user = await getCurrentUser();

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 py-3">
        <Link
          href="/"
          className="mr-auto flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md">
            <Spade className="size-4" aria-hidden />
          </span>
          Free Poker
        </Link>

        <NavLink href="/leaderboard" icon={<Trophy className="size-4" />}>
          Leaderboard
        </NavLink>
        <NavLink href="/profile" icon={<User className="size-4" />}>
          {user ? user.displayName : "Profile"}
        </NavLink>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
    >
      {icon}
      <span className="max-w-32 truncate">{children}</span>
    </Link>
  );
}
