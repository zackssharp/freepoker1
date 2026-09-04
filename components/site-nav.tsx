import { Spade, Trophy, User } from "lucide-react";
import Link from "next/link";

import { NavLink } from "@/components/nav-link";

import { getCurrentUser } from "@/lib/session";

export async function SiteNav() {
  const user = await getCurrentUser();

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
      <nav aria-label="Main navigation" className="mx-auto flex w-full max-w-6xl items-center gap-1 px-3 py-4 sm:px-6">
        <Link
          href="/"
          className="mr-auto flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-xl">
            <Spade className="size-4" aria-hidden />
          </span>
          <span>Free Poker<span className="mt-0.5 hidden text-[9px] font-normal tracking-[0.2em] text-muted-foreground sm:block">A SEAT IS ALWAYS OPEN</span></span>
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
