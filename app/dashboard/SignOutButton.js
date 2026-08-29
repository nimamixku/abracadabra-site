"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  async function handleClick() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        background: "none",
        border: "1px solid var(--card-line)",
        color: "var(--ink-dim)",
        borderRadius: 8,
        padding: "0.4rem 0.8rem",
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
