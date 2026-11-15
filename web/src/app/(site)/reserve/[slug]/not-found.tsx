import { CAR_GONE, NotFoundScreen } from "@/components/site/NotFoundScreen";

/** A reserve link for a car that is no longer listed: the address is right, the car is what has gone. */
export default function ReserveNotFound() {
  return <NotFoundScreen {...CAR_GONE} />;
}
