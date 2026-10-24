import type { Metadata } from "next";
import { SavedList } from "@/components/saved/SavedList";
import { PageIntro } from "@/components/site/PageIntro";
import { pageAddress } from "@/lib/site";

export const metadata: Metadata = {
  title: "My saved cars",
  // Personal to each visitor's device: nothing here for a search engine.
  robots: { index: false, follow: true },
  ...pageAddress("/saved"),
};

/**
 * My saved cars.
 *
 * Its one job: bring a visitor back. A shortlist to return to, and a price
 * alert that brings them back on its own when a car they want gets cheaper.
 */
export default function SavedPage() {
  return (
    <>
      <PageIntro eyebrow="My saved cars" title="Cars you have saved.">
        <p>Tap the heart on any car and it is kept here with today’s price. You can ask to be told if the price drops.</p>
      </PageIntro>
      <section className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-20">
        <SavedList />
      </section>
    </>
  );
}
