import { Spade, Trophy, User } from "lucide-react";
import Link from "next/link";

import { NavLink } from "@/components/nav-link";

import { getCurrentUser } from "@/lib/session";

export async function SiteNav() {
  const user = await getCurrentUser();

  return (
    <header className="casino-header sticky top-0 z-30">
      <nav aria-label="Main navigation" className="mx-auto flex w-full max-w-7xl items-center gap-1 px-3 py-2 sm:px-6">
        <Link
          href="/"
          aria-label="Free Poker home"
          className="casino-brand mr-auto flex items-center gap-2"
        >
          <span className="brand-chip">
            <Spade className="size-4" aria-hidden />
          </span>
          <span className="brand-wordmark">FREE <strong>POKER</strong></span>
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
