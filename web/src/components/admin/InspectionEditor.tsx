"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  inspectionPhotoTicket,
  publishInspection,
  recordCheckPhoto,
  removeCheckPhoto,
  saveCheck,
  saveInspectionDetails,
  type InspectionResult,
} from "@/lib/actions/inspections";
import { CHECKS, RESULT_LABEL, SECTIONS, type Check as ChecklistCheck, type ItemResult, type Items, type Result } from "@/lib/inspection/checklist";
import { shrink } from "./shrink";

export interface EditableReport {
  id: string;
  code: string;
  inspectedOn: string | null;
  inspectorName: string | null;
  odometerKm: number | null;
  vin: string | null;
  summary: string | null;
  historySource: string | null;
  historyCheckedOn: string | null;
  historyTitle: string | null;
  historyAccidents: number | null;
  historyLastOdometerKm: number | null;
  historyNotes: string | null;
  items: Items;
}

const input =
  "min-h-12 w-full border border-border-strong bg-surface-0 px-4 text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-green-500 disabled:opacity-60";

const RESULT_STYLE: Record<Result, string> = {
  pass: "border-success text-success",
  attention: "border-warning text-warning",
  fail: "border-danger text-danger",
  na: "border-border-strong text-text-secondary",
};

const TITLES: [string, string][] = [
  ["clean", "Clean title"],
  ["salvage", "Salvage"],
  ["rebuilt", "Rebuilt"],
  ["flood", "Flood"],
  ["other", "Other (say in the notes)"],
  ["no_record", "No record found"],
];

/** Module level, so typing in it is never wiped by a re-render (see VehicleForm). */
function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="grid content-start gap-2">
      <span className="eyebrow !text-text-secondary">{label}</span>
      {children}
      {error ? <span className="text-sm text-danger">{error}</span> : hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}

/**
 * One check: four results, a note, and a photo. Every change saves at once,
 * because an inspection is done standing beside the car on a phone, where a
 * forgotten Save button costs a whole inspection.
 */
function CheckRow({ reportId, check, item, onChange }: { reportId: string; check: ChecklistCheck; item: ItemResult | undefined; onChange: (next: ItemResult) => void }) {
  const [note, setNote] = useState(item?.note ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const needsEvidence = item?.result === "attention" || item?.result === "fail";

  async function run(work: () => Promise<InspectionResult>) {
    setStatus("saving");
    setError(null);
    try {
      const r = await work();
      if (!r.ok) throw new Error(r.error ?? "Not saved");
      setStatus("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Not saved. Check the connection and try again.");
      setStatus("idle");
    }
  }

  function choose(result: Result) {
    onChange({ ...item, result, note: note.trim() || undefined });
    run(() => saveCheck(reportId, check.key, result, note));
  }

  function saveNote() {
    if (!item?.result || note.trim() === (item.note ?? "")) return;
    onChange({ ...item, note: note.trim() || undefined });
    run(() => saveCheck(reportId, check.key, item.result, note));
  }

  async function addPhoto(f: File | undefined) {
    if (!f || !item?.result) return;
    await run(async () => {
      const ticket = await inspectionPhotoTicket(reportId);
      if ("error" in ticket) return { ok: false, error: ticket.error };
      const body = new FormData();
      for (const [k, v] of Object.entries(ticket.fields)) body.set(k, v);
      body.set("file", await shrink(f), f.name.replace(/\.\w+$/, ".jpg"));
      const res = await fetch(ticket.url, { method: "POST", body });
      const asset = await res.json();
      if (!res.ok) return { ok: false, error: asset?.error?.message ?? "Upload refused" };
      const saved = await recordCheckPhoto(reportId, check.key, asset);
      if (saved.ok) onChange({ ...item, photo: { url: asset.secure_url, publicId: asset.public_id } });
      return saved;
    });
    if (file.current) file.current.value = "";
  }

  function dropPhoto() {
    if (!item) return;
    const next = { ...item };
    delete next.photo;
    onChange(next);
    run(() => removeCheckPhoto(reportId, check.key));
  }

  return (
    <li className="grid gap-3 border-t border-border-subtle py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-text-primary">{check.label}</p>
          {check.how && <p className="mt-1 text-sm text-text-muted">{check.how}</p>}
        </div>
        <span aria-live="polite" className="shrink-0 text-xs text-text-muted">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </span>
      </div>
      <div role="radiogroup" aria-label={check.label} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(RESULT_LABEL) as Result[]).map((r) => {
          const on = item?.result === r;
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(r)}
              className={`min-h-12 border px-3 text-sm font-semibold transition-colors ${on ? `${RESULT_STYLE[r]} bg-surface-2` : "border-border-default text-text-secondary hover:border-border-strong"}`}
            >
              {on && <Check aria-hidden size={14} className="mr-1.5 inline" />}
              {RESULT_LABEL[r]}
            </button>
          );
        })}
      </div>
      {item?.result && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <label className="grid gap-1.5">
            <span className="sr-only">Note for {check.label}</span>
            <textarea
              rows={2}
              value={note}
              maxLength={400}
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
              placeholder={needsEvidence ? "What was found (required)" : "Note (optional)"}
              className={`${input} py-3 leading-relaxed ${needsEvidence && !note.trim() ? "border-warning" : ""}`}
            />
          </label>
          <div className="flex items-center gap-3">
            {item.photo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- a small Cloudinary thumbnail */}
                <img src={item.photo.url.replace("/upload/", "/upload/c_fill,w_160,h_120,q_auto,f_auto/")} alt="" width={80} height={60} className="h-15 w-20 object-cover" />
                <button type="button" onClick={dropPhoto} className="inline-flex min-h-12 items-center gap-1.5 text-sm text-text-secondary hover:text-danger">
                  <Trash2 aria-hidden size={16} /> Remove
                </button>
              </>
            ) : (
              <label
                className={`inline-flex min-h-12 cursor-pointer items-center gap-2 border px-4 text-sm font-semibold ${needsEvidence ? "border-warning text-warning" : "border-border-default text-text-secondary"}`}
              >
                <Camera aria-hidden size={18} /> {needsEvidence ? "Add photo (required)" : "Add photo"}
                <input ref={file} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => addPhoto(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </li>
  );
}

/**
 * The Sabicars Verified inspection, as staff fill it in: the details first,
 * then every check grouped the way an inspector walks round the car, and a
 * publish bar that says exactly what is still missing.
 */
export function InspectionEditor({ report, canPublish }: { report: EditableReport; canPublish: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Items>(report.items);
  const [details, saveDetails, savingDetails] = useActionState(saveInspectionDetails, null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<InspectionResult | null>(null);
  const answered = CHECKS.filter((c) => items[c.key]?.result).length;
  const err = (k: string) => details?.fieldErrors?.[k];

  async function publish() {
    setPublishing(true);
    setPublished(null);
    try {
      const r = await publishInspection(report.id);
      setPublished(r);
      if (r.ok) router.refresh();
    } catch {
      setPublished({ ok: false, error: "Not published. Check the connection and try again." });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="grid gap-12 pb-32">
      <form action={saveDetails} className="grid gap-6 sm:grid-cols-2" noValidate>
        <input type="hidden" name="id" value={report.id} />
        <h2 className="eyebrow sm:col-span-2">The inspection</h2>
        <Field label="Date inspected" error={err("inspectedOn")}>
          <input type="date" name="inspectedOn" defaultValue={report.inspectedOn ?? ""} className={input} />
        </Field>
        <Field label="Inspected by" hint="The person who did it, e.g. a staff member or the mechanic" error={err("inspectorName")}>
          <input name="inspectorName" defaultValue={report.inspectorName ?? ""} maxLength={80} className={input} />
        </Field>
        <Field label="Odometer (km)" hint="Read off the dashboard today, not the listing" error={err("odometerKm")}>
          <input name="odometerKm" inputMode="numeric" defaultValue={report.odometerKm?.toLocaleString("en-NG") ?? ""} className={`figures ${input}`} />
        </Field>
        <Field label="Chassis number (VIN)" hint="As stamped on the frame. Shown in public with the last four hidden." error={err("vin")}>
          <input name="vin" defaultValue={report.vin ?? ""} autoCapitalize="characters" className={`figures uppercase ${input}`} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Summary" hint="In plain words, what a buyer should know first" error={err("summary")}>
            <textarea name="summary" rows={3} defaultValue={report.summary ?? ""} maxLength={1200} className={`${input} py-3 leading-relaxed`} />
          </Field>
        </div>

        <h2 className="eyebrow mt-4 sm:col-span-2">History report (optional)</h2>
        <Field label="Source" hint="e.g. Carfax via LegitCar, or the Japanese auction sheet" error={err("historySource")}>
          <input name="historySource" defaultValue={report.historySource ?? ""} maxLength={80} className={input} />
        </Field>
        <Field label="Checked on" error={err("historyCheckedOn")}>
          <input type="date" name="historyCheckedOn" defaultValue={report.historyCheckedOn ?? ""} className={input} />
        </Field>
        <Field label="Title" error={err("historyTitle")}>
          <select name="historyTitle" defaultValue={report.historyTitle ?? ""} className={input}>
            <option value="">Not recorded</option>
            {TITLES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Accidents recorded" error={err("historyAccidents")}>
          <input name="historyAccidents" inputMode="numeric" defaultValue={report.historyAccidents ?? ""} className={`figures ${input}`} />
        </Field>
        <Field label="Last odometer on record (km)" hint="Lower than today's reading is expected; higher means the odometer was wound back" error={err("historyLastOdometerKm")}>
          <input name="historyLastOdometerKm" inputMode="numeric" defaultValue={report.historyLastOdometerKm?.toLocaleString("en-NG") ?? ""} className={`figures ${input}`} />
        </Field>
        <Field label="History notes" error={err("historyNotes")}>
          <textarea name="historyNotes" rows={2} defaultValue={report.historyNotes ?? ""} maxLength={600} className={`${input} py-3 leading-relaxed`} />
        </Field>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <Button type="submit" variant="secondary" disabled={savingDetails}>
            {savingDetails ? "Saving…" : "Save details"}
          </Button>
          <p aria-live="polite" className="text-sm">
            {details?.error ? <span className="text-danger">{details.error}</span> : details?.ok ? <span className="text-success">Details saved</span> : null}
          </p>
        </div>
      </form>

      {SECTIONS.map((s) => {
        const live = s.checks.filter((c) => !c.retired);
        const done = live.filter((c) => items[c.key]?.result).length;
        return (
          <section key={s.key} aria-labelledby={`sec-${s.key}`}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 id={`sec-${s.key}`} className="eyebrow">
                {s.title}
              </h2>
              <span className={`figures text-sm ${done === live.length ? "text-success" : "text-text-muted"}`}>
                {done} of {live.length}
              </span>
            </div>
            <ul className="mt-3">
              {live.map((c) => (
                <CheckRow key={c.key} reportId={report.id} check={c} item={items[c.key]} onChange={(next) => setItems((all) => ({ ...all, [c.key]: next }))} />
              ))}
            </ul>
          </section>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-default bg-surface-0/95 backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl gap-3 px-5 py-3 md:px-8">
          {published && !published.ok && (
            <div role="alert" className="max-h-40 overflow-y-auto text-sm">
              <p className="text-danger">{published.error}</p>
              {published.problems && (
                <ul className="mt-1 list-disc pl-5 text-text-secondary">
                  {published.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <p className="figures min-w-0 truncate text-sm text-text-secondary">
              {answered} of {CHECKS.length} checks · SV-{report.code}
            </p>
            {canPublish ? (
              <Button type="button" onClick={publish} disabled={publishing} className="shrink-0">
                {publishing ? "Publishing…" : "Publish report"}
              </Button>
            ) : (
              <p className="shrink-0 text-xs text-text-muted">A manager publishes the report</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
