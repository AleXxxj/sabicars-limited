import { CAR_GONE, NotFoundScreen } from "@/components/site/NotFoundScreen";

/**
 * A car link that no longer answers: the car was sold and taken down, or the
 * address came from an old message. Most such links arrive from WhatsApp, so
 * the page says what happened and keeps the buyer in the showroom.
 */
export default function VehicleNotFound() {
  return <NotFoundScreen {...CAR_GONE} />;
}
