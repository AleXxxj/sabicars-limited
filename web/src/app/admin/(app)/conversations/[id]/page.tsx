import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChatReply } from "@/components/admin/ChatReply";
import { HandledButton } from "@/components/admin/HandledButton";
import { LiveRefresh } from "@/components/admin/LiveRefresh";
import { PublishFromChat } from "@/components/admin/PublishFromChat";
import { can, requireStaff } from "@/lib/auth";
import { describeDirectives } from "@/lib/assistant/parts";
import { staffPresent } from "@/lib/assistant/seller";
import { staffFirstName } from "@/lib/assistant/seller-room";
import { referenceFor } from "@/lib/reference";
import { conversationDetail } from "@/lib/repositories/ask";
import { vehiclesWithPages } from "@/lib/repositories/vehicles";
import { vehicleTitle } from "@/lib/vehicle";

export const metadata: Metadata = { title: "Conversation · Admin", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

const when = (d: Date) =>
  new Date(d).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });

export default async function ConversationPage({ params }: Props) {
  const me = await requireStaff();
  const c = await conversationDetail((await params).id);
  if (!c) notFound();
  const cars = await vehiclesWithPages(c.vehiclesShown);
  const titles = new Map(cars.map((v) => [v.slug, vehicleTitle(v)]));
  const title = (slug: string) => titles.get(slug) ?? slug;
  const canPublish = me.role !== "sales";
  const seller = c.mode === "seller";
  // A seller chat is read by whoever answers it — the buyer asked for the team. A chat with Sabi stays with the owner and managers.
  const canRead = seller || can.readTranscripts(me);
  const waiting = Boolean(c.awaitingSince);

  return (
    <>
      {/* A seller chat is live: the page follows it every few seconds while it is open. */}
      {seller && <LiveRefresh everyMs={waiting || staffPresent(c.lastStaffAt) ? 5_000 : 20_000} />}
      <Link
        href="/admin/conversations"
        className="inline-flex min-h-10 items-center gap-1.5 text-sm text-text-muted hover:text-text-primary"
      >
        <ArrowLeft aria-hidden size={16} /> Conversations
      </Link>
      <h1 className="mt-3 text-display-3">{c.intent ?? (seller ? "Chat with the team" : "Conversation")}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
        Started {when(c.createdAt)}
        {c.landingPath && <> on {c.landingPath}</>} · {seller ? `${c.messageCount} messages` : `${c.messageCount / 2} ${c.messageCount === 2 ? "question" : "questions"}`}
        {seller && waiting && (
          <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-xs font-semibold text-orange-200">Waiting for a person since {when(c.awaitingSince!)}</span>
        )}
        {seller && !waiting && staffPresent(c.lastStaffAt) && (
          <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-semibold text-green-200">A person is in the room</span>
        )}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="order-2 grid gap-4 lg:order-1">
          {!canRead && (
            <p className="rounded-2xl border border-border-subtle bg-surface-1 px-4 py-3 text-sm text-text-secondary">
              The words of a chat are read by the owner and managers. The summary and the buyer&rsquo;s details are on the right, which is what a call needs.
            </p>
          )}
          {(canRead ? c.messages : []).map((m, i) => {
            const text = describeDirectives(m.content, title);
            const prev = c.messages[i - 1];
            if (m.role === "user")
              return (
                <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md border border-green-500/25 bg-green-500/[0.1] px-4 py-3">
                  <p className="whitespace-pre-wrap text-text-primary">{m.content}</p>
                  <p className="mt-1 text-right text-[0.7rem] text-text-muted">{when(m.createdAt)}</p>
                </div>
              );
            if (m.role === "staff")
              return (
                <div key={m.id} className="max-w-[92%] rounded-2xl rounded-bl-md border border-orange-400/30 bg-orange-500/[0.06] px-4 py-3">
                  <p className="text-[0.7rem] font-semibold tracking-wide text-orange-200 uppercase">
                    {m.staffName ?? "Sabicars team"} · {when(m.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-text-primary">{m.content}</p>
                </div>
              );
            return (
              <div key={m.id} className="max-w-[92%] rounded-2xl rounded-bl-md border border-border-subtle bg-surface-1 px-4 py-3">
                <p className="text-[0.7rem] font-semibold tracking-wide text-green-300 uppercase">Sabi · {when(m.createdAt)}</p>
                <p className="mt-1 whitespace-pre-wrap text-text-secondary">{text}</p>
                {canPublish && prev?.role === "user" && (
                  <PublishFromChat question={prev.content} answer={m.content.replace(/\[\[[^\]]*\]\]/g, "").trim()} conversationId={c.id} />
                )}
              </div>
            );
          })}
          {seller && <ChatReply conversationId={c.id} name={staffFirstName(me)} waiting={waiting} />}
        </section>

        <aside className="order-1 grid content-start gap-4 lg:order-2">
          {seller && (
            <div className="border border-orange-400/30 bg-orange-500/[0.05] p-5 text-sm text-text-secondary">
              <p className="font-semibold text-text-primary">Chat with seller</p>
              <p className="mt-1">
                The buyer asked for a person. Your reply reaches their phone in seconds. If nobody answers within about a minute while the
                showroom is open, Sabi answers and says the team has been told.
              </p>
            </div>
          )}
          <div className="border border-border-subtle bg-surface-1 p-5">
            <p className="eyebrow">Summary</p>
            <p className="mt-2 text-sm text-text-secondary">
              {c.summary ?? "Summarised after the second question, or as soon as the buyer shares a number."}
            </p>
          </div>
          <div className="border border-border-subtle bg-surface-1 p-5 text-sm">
            {c.leadId ? (
              <>
                <p className="text-text-muted">Became an enquiry</p>
                <Link href={`/admin/leads/${c.leadId}`} className="mt-1 inline-block font-semibold text-green-300 hover:text-green-200">
                  {c.leadName ?? "Open it"} · {referenceFor(c.leadId)} →
                </Link>
              </>
            ) : (
              <p className="text-text-muted">No contact details given — nothing to follow up.</p>
            )}
            {c.needsHuman && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-200">Wants a person</span>
                <HandledButton id={c.id} />
              </div>
            )}
          </div>
          {cars.length > 0 && (
            <div className="border border-border-subtle bg-surface-1 p-5 text-sm">
              <p className="text-text-muted">Cars shown</p>
              <ul className="mt-2 grid gap-1.5">
                {cars.map((v) => (
                  <li key={v.id}>
                    <Link href={`/vehicles/${v.slug}`} className="text-text-primary hover:text-green-200">
                      {vehicleTitle(v)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
