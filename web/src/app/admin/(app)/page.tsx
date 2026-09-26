import { redirect } from "next/navigation";

/** The admin opens on enquiries — a buyer waiting matters more than anything else on the list. */
export default function AdminHome() {
  redirect("/admin/leads");
}
