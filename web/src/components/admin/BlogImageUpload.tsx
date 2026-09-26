"use client";

import { useState } from "react";
import { blogUploadTicket, confirmBlogUpload } from "@/lib/actions/blog-admin";

/** A photo from the phone or computer, straight to Cloudinary, back as an address for the article. */
export function BlogImageUpload({ onUploaded, label = "Upload a photo" }: { onUploaded: (url: string) => void; label?: string }) {
  const [state, setState] = useState<"idle" | "uploading" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setState("uploading");
    setError(null);
    try {
      const ticket = await blogUploadTicket();
      if ("error" in ticket) throw new Error(ticket.error);
      const body = new FormData();
      for (const [k, v] of Object.entries(ticket.fields)) body.set(k, v);
      body.set("file", file);
      const res = await fetch(ticket.url, { method: "POST", body });
      if (!res.ok) throw new Error("The upload did not go through.");
      const confirmed = await confirmBlogUpload(await res.json());
      if ("error" in confirmed) throw new Error(confirmed.error);
      onUploaded(confirmed.url);
      setState("idle");
    } catch (e) {
      setError((e as Error).message);
      setState("failed");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <label
        className={`inline-flex min-h-10 cursor-pointer items-center border border-gold-700 px-3 text-xs font-semibold text-accent-text hover:bg-surface-2 ${state === "uploading" ? "pointer-events-none opacity-60" : ""}`}
      >
        {state === "uploading" ? "Uploading…" : label}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
