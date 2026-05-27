"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.replace("/login");
      }}
      title="Sign out"
      aria-label="Sign out"
      className="inline-flex items-center justify-center rounded-md transition"
      style={{ width: 32, height: 32, color: "var(--glass-text-tertiary)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--glass-surface-hover)";
        e.currentTarget.style.color = "var(--glass-text)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--glass-text-tertiary)";
      }}
    >
      <LogOut size={15} />
    </button>
  );
}
