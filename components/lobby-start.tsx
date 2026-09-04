"use client";

import { ArrowLeft, BookOpen, Play, Trophy } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { NewTableForm } from "@/components/new-table-form";

export function LobbyStart({ defaultName, activeGameId }: { defaultName?: string; activeGameId: string | null }) {
  const [settingUp, setSettingUp] = useState(false);
  const playButton = useRef<HTMLButtonElement>(null);

  return (
    <section className="casino-stage" aria-label="Free Poker game">
      <div className="stage-topline"><span>TEXAS HOLD’EM</span><span>ALWAYS FREE TO PLAY</span></div>
      {settingUp ? (
        <div className="casino-setup">
          <button className="setup-back" onClick={() => { setSettingUp(false); requestAnimationFrame(() => playButton.current?.focus()); }}><ArrowLeft size={16} aria-hidden /> Back</button>
          <h1 tabIndex={-1} ref={(node) => node?.focus()} className="setup-title">LET’S PLAY</h1>
          <p className="mb-5 text-center text-sm text-muted-foreground">Choose your table and we’ll deal you in.</p>
          <NewTableForm defaultName={defaultName} />
        </div>
      ) : (
        <div className="casino-title-screen">
          <h1 className="casino-title"><span>FREE</span><strong>POKER</strong></h1>
          <p className="casino-tagline">TEXAS HOLD’EM · NO LIMIT · ALL FUN</p>
          <div className="casino-emblem" aria-hidden="true"><div className="emblem-chip"><span>♠</span></div></div>
          <div className="casino-menu">
            <button ref={playButton} className="arcade-button" onClick={() => setSettingUp(true)}><Play fill="currentColor" aria-hidden /> PLAY</button>
            <Link className="arcade-button" href="/leaderboard"><Trophy aria-hidden /> SCORES</Link>
          </div>
          {activeGameId && <Link className="resume-link" href={`/table/${activeGameId}`}>Continue your game <span aria-hidden>→</span></Link>}
          <a className="how-to-link" href="#how-to-play"><BookOpen size={16} aria-hidden /> How to play</a>
        </div>
      )}
      <div className="stage-bottomline"><span aria-hidden>♠ ♥ ♣ ♦</span><span>Just cards. Just chips. Just for fun.</span><span aria-hidden>♦ ♣ ♥ ♠</span></div>
    </section>
  );
}
