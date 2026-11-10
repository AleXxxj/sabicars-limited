import { ButtonLink } from "@/components/ui/Button";

/**
 * An admin address with nothing behind it: most often an alert on a phone
 * about an enquiry that has since been deleted. Back to the inbox, not a
 * bare "404".
 */
export default function AdminNotFound() {
  return (
    <div className="py-16 text-center">
      <p className="eyebrow">Not found</p>
      <h1 className="mt-2 text-display-3">Nothing here.</h1>
      <p className="mx-auto mt-4 max-w-md text-text-secondary">
        This record may have been deleted, or the link is old. Alerts about a deleted enquiry land here.
      </p>
      <div className="mt-8">
        <ButtonLink href="/admin">Back to the inbox</ButtonLink>
      </div>
    </div>
  );
}
