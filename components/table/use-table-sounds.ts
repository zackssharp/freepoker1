"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionType } from "@/lib/poker/engine";
import type { TableView } from "@/lib/poker/view";

/** Original, quiet table effects synthesized locally; no downloads required. */
export function useTableSounds() {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const context = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    const current = context.current;
    context.current = null;
    if (current) void current.close().catch(() => {});
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [stop]);

  // Called directly from a user gesture to satisfy browser autoplay rules.
  const unlock = useCallback(() => {
    if (mutedRef.current) return;
    try {
      context.current ??= new AudioContext();
      if (context.current.state === "suspended") {
        void context.current.resume().catch(() => {});
      }
    } catch {
      // Audio support must never prevent a poker action.
    }
  }, []);

  const toggleMuted = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) stop();
    else unlock();
  }, [stop, unlock]);

  const playResult = useCallback((before: TableView, after: TableView, action?: ActionType) => {
    const ctx = context.current;
    if (mutedRef.current || document.hidden || !ctx || ctx.state !== "running") return;

    try {
      const start = ctx.currentTime + 0.01;
      const tone = (offset: number, frequency: number, duration: number, volume: number) => {
        const source = ctx.createOscillator();
        const gain = ctx.createGain();
        source.type = "sine";
        source.frequency.setValueAtTime(frequency, start + offset);
        source.frequency.exponentialRampToValueAtTime(frequency * 0.7, start + offset + duration);
        gain.gain.setValueAtTime(0, start + offset);
        gain.gain.linearRampToValueAtTime(volume, start + offset + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
        source.connect(gain).connect(ctx.destination);
        source.onended = () => { source.disconnect(); gain.disconnect(); };
        source.start(start + offset);
        source.stop(start + offset + duration + 0.01);
      };
      const swish = (offset: number, duration = 0.09) => {
        const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        source.buffer = buffer;
        filter.type = "bandpass";
        filter.frequency.value = 1800;
        filter.Q.value = 0.7;
        gain.gain.setValueAtTime(0, start + offset);
        gain.gain.linearRampToValueAtTime(0.12, start + offset + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
        source.connect(filter).connect(gain).connect(ctx.destination);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
        source.start(start + offset);
      };
      const chips = (offset: number) => {
        [1700, 2300, 1950].forEach((frequency, i) => tone(offset + i * 0.045, frequency, 0.055, 0.055));
      };

      let offset = 0;
      if (action === "fold") { swish(0, 0.14); offset = 0.18; }
      else if (action === "check") {
        tone(0, 260, 0.045, 0.12);
        tone(0.09, 230, 0.045, 0.1);
        offset = 0.2;
      } else if (action) { chips(0); offset = 0.2; }

      const newHand = after.handNumber !== before.handNumber;
      const dealt = newHand ? 2 + after.board.length : Math.max(0, after.board.length - before.board.length);
      for (let i = 0; i < dealt; i++) swish(offset + i * 0.1);
      offset += dealt * 0.1;

      if (after.lastHand && after.lastHand.handNumber !== before.lastHand?.handNumber) {
        chips(offset + 0.08);
        const won = after.lastHand.awards.some((award) => award.seatId === after.heroSeatId && award.amount > 0);
        if (won) [523.25, 659.25, 783.99].forEach((frequency, i) => tone(offset + 0.25 + i * 0.11, frequency, 0.3, 0.075));
      } else if (after.legal) {
        tone(offset + 0.12, 880, 0.12, 0.035);
      }
    } catch {
      // A browser/device audio failure must not interfere with gameplay.
    }
  }, []);

  return { muted, toggleMuted, unlock, playResult };
}
