import { eventFromApi } from "@/lib/events/form";
import { backendGetEvent } from "@/lib/events/backend";

import { eventFitContext, shouldLoadEvent, type EventFitContext } from "@/lib/emergency/event-fit";

export type EventFitLoad =
  | { status: "plain" }
  | { status: "ready"; event: EventFitContext }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "unauthorized" };

export async function prepareEmergencyFit(
  accessToken: string,
  eventParam: string | string[] | undefined,
): Promise<EventFitLoad> {
  const eventId = shouldLoadEvent(eventParam);
  if (!eventId) return { status: "plain" };
  const result = await backendGetEvent(accessToken, eventId);
  if (!result.ok) {
    if (result.kind === "not_found") return { status: "not_found" };
    if (result.kind === "unauthorized") return { status: "unauthorized" };
    return { status: "unavailable" };
  }
  const event = eventFromApi(result.data);
  if (!event) return { status: "unavailable" };
  return { status: "ready", event: eventFitContext(event) };
}
