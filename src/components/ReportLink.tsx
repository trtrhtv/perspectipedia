"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

// לינק "דיווח על בעיה/הטיה" בתחתית עדשה (PLAN 1.4).
// ה-slug נגזר מה-URL — אין צורך להשחיל אותו דרך כל עץ הרכיבים.
export default function ReportLink({ lensName }: { lensName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const slugMatch = pathname.match(/^\/entry\/([^/]+)/);
  if (!slugMatch) return null;
  const slug = decodeURIComponent(slugMatch[1]);

  async function send() {
    if (!reason.trim()) return;
    setState("sending");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, lensName, reason: reason.trim() }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return <p className="mt-2 text-xs text-muted">תודה — הדיווח התקבל וייבדק.</p>;
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-muted/80 underline-offset-2 hover:text-accent hover:underline"
        >
          דיווח על בעיה או הטיה בעדשה הזו
        </button>
      ) : (
        <div className="mt-1 rounded-xl border border-line bg-white p-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="מה הבעיה? (ייצוג לא הוגן, מקור שגוי, ניסוח פוגעני…)"
            rows={3}
            className="w-full rounded-lg border border-line bg-transparent p-2 text-sm outline-none focus:border-accent"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={send}
              disabled={state === "sending" || !reason.trim()}
              className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {state === "sending" ? "שולח…" : "שליחת דיווח"}
            </button>
            <button onClick={() => setOpen(false)} className="text-xs text-muted hover:underline">
              ביטול
            </button>
            {state === "error" && <span className="text-xs text-red-600">השליחה נכשלה. נסו שוב.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
