import { redirect } from "next/navigation";

/** Until the public site is built (phase 2), the root shows the design system. */
export default function Home() {
  redirect("/style");
}
