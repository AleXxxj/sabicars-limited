"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Flag, RotateCcw } from "lucide-react";
import { FAMILY_RACERS, SCENARIOS, familySpec, familyVerdict } from "@/components/blog/illustrations/HiaceFamilyRace";
import { HUMMER_RACERS, hummerSpec } from "@/components/blog/illustrations/HummerRace";
import { JOBS, SETUPS } from "@/components/blog/illustrations/hummers";
import { RaceTrack, type Phase, type TrackHandle } from "@/components/blog/illustrations/race/RaceTrack";
import type { RaceKind } from "@/lib/assistant/parts";
import { anchorFor } from "@/lib/blog/blocks";

const GUIDE = "/blog/toyota-hiace-hummer-bus-buyers-guide";

const RACES: Record<RaceKind, { title: string; section: string; choices: { id: string; label: string }[]; first: string }> = {
  family: {
    title: "Old Hiace vs Hummer 1, 2 and 3",
    section: anchorFor("Hummer 1, 2 or 3: what is the difference?"),
    choices: SCENARIOS.map((s) => ({ id: s.id, label: s.label })),
    first: "full",
  },
  powertrain: {
    title: "Petrol or diesel, manual or automatic",
    section: anchorFor("Petrol or diesel, manual or automatic"),
    choices: JOBS.map((j) => ({ id: j.id, label: j.short })),
    first: JOBS[0].id,
  },
};

/**
 * A race in the chat: the same races as the Hummer buyer's guide, small
 * enough for the chat window. Ask Sabicars offers one after explaining how
 * the buses differ, so the buyer can see it rather than take its word.
 */
export function ChatRace({ race }: { race: RaceKind }) {
  const r = RACES[race];
  const [choice, setChoice] = useState(r.first);
  const scenario = SCENARIOS.find((s) => s.id === choice);
  const job = JOBS.find((j) => j.id === choice);
  const spec = useMemo(() => (race === "family" ? familySpec(scenario!) : hummerSpec(job!)), [race, scenario, job]);
  const [phase, setPhase] = useState<Phase>("ready");
  const [order, setOrder] = useState<string[]>([]);
  const track = useRef<TrackHandle>(null);
  const busy = phase === "countdown" || phase === "racing";

  let verdict: string[] = [];
  if (phase === "done" && order.length) {
    if (race === "family" && scenario) verdict = familyVerdict(scenario, order, spec.durations).lines.slice(0, 3);
    if (race === "powertrain" && job) {
      const w = SETUPS.find((s) => s.id === order[0])!;
      verdict = [
        `The ${w.fuel} ${w.gearbox} Hummer wins “${job.label.toLowerCase()}”. Every one of the four wins a different job — choose by how the bus will work.`,
      ];
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-surface-2/50 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Flag aria-hidden size={15} className="text-gold-300" /> {r.title}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {r.choices.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === choice}
            disabled={busy}
            onClick={() => {
              track.current?.reset();
              setOrder([]);
              setChoice(c.id);
            }}
            className={`min-h-9 rounded-full border px-3 text-xs transition-all active:scale-95 disabled:opacity-60 ${c.id === choice ? "border-gold-400 bg-gold-500/15 font-semibold text-gold-100" : "border-white/[0.12] text-text-secondary hover:text-text-primary"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <RaceTrack
          compact
          racers={race === "family" ? FAMILY_RACERS : HUMMER_RACERS}
          spec={spec}
          handle={track}
          onPhase={setPhase}
          onFinish={setOrder}
        />
      </div>

      <button
        type="button"
        onClick={() => {
          setOrder([]);
          track.current?.start();
        }}
        disabled={busy}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-[linear-gradient(180deg,var(--gold-300),var(--gold-500))] px-5 text-sm font-semibold text-[#0A0908] transition-transform active:scale-95 disabled:opacity-50"
      >
        {phase === "done" ? <RotateCcw aria-hidden size={15} /> : <Flag aria-hidden size={15} />}
        {phase === "done" ? "Race again" : phase === "ready" ? "Start the race" : "On the road…"}
      </button>

      {verdict.length > 0 && (
        <div className="mt-3 grid gap-1.5 text-[0.85rem] leading-relaxed text-text-secondary" aria-live="polite">
          {verdict.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      )}

      <Link
        href={`${GUIDE}#${r.section}`}
        className="group mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-gold-300 hover:text-gold-200"
      >
        The full race, with every bus&rsquo;s specs
        <ArrowRight aria-hidden size={15} className="transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  );
}
