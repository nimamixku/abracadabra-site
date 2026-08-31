"use client";

import { useEffect, useRef, useState } from "react";

// Ambient split-flap board -- reuses the exact scramble/flip mechanic and
// styling built for the original site's paid "marquee" feature, just
// auto-cycling on a timer instead of being spent as a play. Phrases here
// are pulled straight from the platform's own design ethos, kept short
// and positive -- what the platform actually does, not a comparison to
// anything else.
const PHRASES = [
  "INSTANT PAY",
  "INSTANT DOWNLOAD",
  "INFINITE SCROLL, ENDLESS SHUFFLE",
  "YOUR ENTIRE CATALOG, ALWAYS ON DISPLAY",
  "FULL RESOLUTION, EVERY TIME",
  "NO CROPPING WITHOUT YOUR CONSENT",
];

export default function MarketingMarquee() {
  const [display, setDisplay] = useState(PHRASES[0]);
  const indexRef = useRef(0);
  const tickRef = useRef(null);
  const cycleRef = useRef(null);

  function scrambleTo(target) {
    let ticks = 0;
    const totalTicks = 16;
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      ticks++;
      if (ticks >= totalTicks) {
        clearInterval(tickRef.current);
        setDisplay(target);
        return;
      }
      const scrambled = target
        .split("")
        .map((ch) => (ch === " " ? " " : String.fromCharCode(65 + Math.floor(Math.random() * 26))))
        .join("");
      setDisplay(scrambled);
    }, 45);
  }

  useEffect(() => {
    cycleRef.current = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % PHRASES.length;
      scrambleTo(PHRASES[indexRef.current]);
    }, 3600);
    return () => {
      clearInterval(cycleRef.current);
      clearInterval(tickRef.current);
    };
  }, []);

  return (
    <div className="marquee-board marketing-marquee-board">
      <span className="marquee-text">{display}</span>
    </div>
  );
}
