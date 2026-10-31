import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/admin/LiveRefresh";
import { requireStaff } from "@/lib/auth";
import { conversationCounts, conversations, type ConversationView } from "@/lib/repositories/ask";

export const metadata: Metadata = { title: "Conversations · Admin", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ view?: string }> };

const VIEWS: Record<ConversationView, string> = { all: "All chats", waiting: "Waiting for a person", person: "Want a call", leads: "Became enquiries" };

const when = (d: Date) =>
  new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

/**
 * Every Ask Sabicars conversation. Chats where the buyer left details are
 * already enquiries in the inbox; the rest are the most honest market research
 * the business has — what people ask at 2am, and what they could not find.
 */
export default async function ConversationsAdmin({ searchParams }: Props) {
  await requireStaff();
  const sp = await searchParams;
  const view: ConversationView = sp.view && sp.view in VIEWS ? (sp.view as ConversationView) : "all";
  const [rows, counts] = await Promise.all([conversations(view), conversationCounts()]);

  return (
    <>
      <p className="eyebrow">Ask Sabicars</p>
      <h1 className="mt-2 text-display-3">Conversations</h1>
      <p className="mt-3 max-w-2xl text-sm text-text-secondary">
        What buyers ask the assistant. A chat where they leave a name and number becomes an enquiry automatically. Turn a good reply into a
        public answer on{" "}
        <Link href="/ask" className="text-green-300">
          /ask
        </Link>{" "}
        from inside the chat.
      </p>

      <nav aria-label="Conversation views" className="mt-8 flex gap-6 overflow-x-auto border-b border-border-subtle [scrollbar-width:none]">
        {(Object.keys(VIEWS) as ConversationView[]).map((v) => (
          <Link
            key={v}
            href={v === "all" ? "/admin/conversations" : `/admin/conversations?view=${v}`}
            aria-current={view === v ? "true" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 text-sm transition-colors ${
              view === v ? "border-green-500 text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {VIEWS[v]}{" "}
            <span className={`figures text-xs ${(v === "person" && counts.person) || (v === "waiting" && counts.waiting) ? "text-accent-text" : "text-text-muted"}`}>
              {counts[v]}
            </span>
          </Link>
        ))}
      </nav>

      {/* A buyer may be waiting for a person: the list keeps itself current while it is open. */}
      <LiveRefresh everyMs={counts.waiting ? 10_000 : 60_000} />
      {rows.length === 0 ? (
        <p className="py-16 text-center text-text-muted">
          {view === "waiting" ? "Nobody is waiting for a person right now." : "No conversations yet. They appear here as buyers use Ask Sabicars."}
        </p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/conversations/${c.id}`}
                className="block border border-border-subtle bg-surface-1 p-5 transition-colors hover:border-green-500/40"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                  <span>{when(c.lastMessageAt)}</span>
                  <span>· {c.mode === "seller" ? `${c.messageCount} messages` : `${c.messageCount / 2} ${c.messageCount === 2 ? "question" : "questions"}`}</span>
                  {c.vehiclesShown.length > 0 && <span>· {c.vehiclesShown.length} cars shown</span>}
                  {c.landingPath && <span>· from {c.landingPath}</span>}
                  {c.awaitingSince && (
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 font-semibold text-orange-200">Waiting for a person since {when(c.awaitingSince)}</span>
                  )}
                  {c.mode === "seller" && !c.awaitingSince && (
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-semibold text-text-secondary">Chat with seller</span>
                  )}
                  {c.needsHuman && (
                    <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-semibold text-green-200">Wants a person</span>
                  )}
                  {c.leadId && (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 font-semibold text-success">
                      Enquiry{c.leadName ? `: ${c.leadName}` : ""}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-semibold text-text-primary">{c.intent ?? c.firstQuestion?.slice(0, 120) ?? "Conversation"}</p>
                {c.summary && <p className="mt-1 line-clamp-2 text-sm text-text-secondary">{c.summary}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
