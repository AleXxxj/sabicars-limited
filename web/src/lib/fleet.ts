/**
 * The fleet request's choices, shared by the form in the browser and the
 * server action that checks it. (A "use server" file may only export async
 * functions, so they cannot live there.)
 */
export const FLEET_VEHICLES = ["Toyota Hiace buses", "Toyota Coaster and larger buses", "SUVs", "Staff and saloon cars", "Pickups", "Trucks and tippers"] as const;
export const FLEET_QUANTITIES = ["2 – 5", "6 – 10", "11 – 25", "26 – 50", "More than 50"] as const;
export const FLEET_TIMEFRAMES = ["As soon as possible", "Within a month", "Within three months", "Planning for later this year"] as const;
