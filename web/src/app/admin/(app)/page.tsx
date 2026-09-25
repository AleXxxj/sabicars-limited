import { redirect } from "next/navigation";

/** The admin opens on inventory — the work most staff come here to do. */
export default function AdminHome() {
  redirect("/admin/vehicles");
}
