"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { topicToSlug } from "@/lib/slug";

export default function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go(topic: string) {
    const t = topic.trim();
    if (!t) return;
    const slug = topicToSlug(t);
    router.push(`/entry/${encodeURIComponent(slug)}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className="w-full"
    >
      <div className="flex items-stretch gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          placeholder="הקלידו נושא — למשל: בריאת העולם, מהו צדק, מהו מוות…"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-lg outline-none placeholder:text-muted/70"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-accent px-5 py-2 font-medium text-white transition hover:bg-accent/90 active:scale-[0.98]"
        >
          חקירה
        </button>
      </div>
    </form>
  );
}
