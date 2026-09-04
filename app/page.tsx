import Link from "next/link";
import { LobbyStart } from "@/components/lobby-start";
import { getActiveGameId } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export default async function LobbyPage() {
  const user = await getCurrentUser();
  const activeGameId = user ? await getActiveGameId(user.id) : null;
  return (
    <>
      <LobbyStart defaultName={user?.displayName} activeGameId={activeGameId} />
      <section id="how-to-play" className="poker-guide">
        <div>
          <p className="guide-eyebrow">PICK UP A HAND. PLAY FOR FUN.</p>
          <h2>Free Texas Hold’em Poker</h2>
          <p>Pull up a seat and play poker against up to five computer opponents. Choose your stakes, practice your reads, and see how far your chips can take you. No download or signup needed.</p>
          <div className="guide-columns">
            <div><h3><span aria-hidden>♠</span> How to play</h3><p>Make the best five-card hand using your two cards and the five community cards. Check, call, raise, or fold as the flop, turn, and river are dealt.</p></div>
            <div><h3><span aria-hidden>♥</span> Know your opponents</h3><p>Every bot has its own playing style. Watch the bets, spot the bluffs, and choose your moment to make a move.</p></div>
            <div><h3><span aria-hidden>♣</span> Keep your score</h3><p>Your hands and results are saved as you play. Visit your <Link href="/profile">profile</Link> or see where you stand on the <Link href="/leaderboard">leaderboard</Link>.</p></div>
          </div>
        </div>
      </section>
      <footer className="casino-footer">Free Poker · Texas Hold’em · Play money only</footer>
    </>
  );
}
