"use client";

import { useEffect } from "react";

// A plain arrow with no hand/pointer affordance on hover doesn't tell
// anyone a click actually registered, so this stands in for that missing
// feedback -- a small glow blooms right where the click landed, then
// fades out. One passive listener on the whole document: works the same
// whether the click hit a button, a photo, or empty space, and never
// delays or interferes with the click's own normal behavior. Rendered
// once in the root layout, so it's active on every page -- the existing
// live single-tenant homepage and every tenant storefront alike.
export default function ClickGlow() {
  useEffect(() => {
    function handleClick(e) {
      const glow = document.createElement("span");
      glow.className = "click-glow";
      glow.style.left = `${e.clientX}px`;
      glow.style.top = `${e.clientY}px`;
      document.body.appendChild(glow);
      glow.addEventListener("animationend", () => glow.remove(), { once: true });
      // Safety net in case animationend never fires (e.g. the tab loses
      // focus mid-animation) so stray nodes can't pile up.
      setTimeout(() => glow.remove(), 700);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
}
