import type { Metadata } from "next";
import { SavedList } from "@/components/saved/SavedList";
import { PageIntro } from "@/components/site/PageIntro";

export const metadata: Metadata = {
  title: "Saved cars",
  // Personal to each visitor's device: nothing here for a search engine.
  robots: { index: false, follow: true },
  alternates: { canonical: "/saved" },
};

/**
 * Saved cars.
 *
 * Its one job: bring a visitor back. A shortlist to return to, and a price
 * alert that brings them back on its own when a car they want gets cheaper.
 */
export default function SavedPage() {
  return (
    <>
      <PageIntro eyebrow="Your shortlist" title="Saved cars.">
        <p>The cars you have hearted, with today’s prices — and an alert if any of them drops.</p>
      </PageIntro>
      <section className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20">
        <SavedList />
      </section>
    </>
  );
}
