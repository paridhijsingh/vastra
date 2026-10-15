export type EventFitContext = {
  id: string;
  name: string;
  occasion: string;
  comfortText: string;
  hasLook: boolean;
};

export const ATTACH_FAILED_MESSAGE = "The look could not be attached. It is still saved.";
export const EVENT_MISSING_ATTACH_MESSAGE =
  "That saved event could not be found. The look is still saved.";

export function shouldLoadEvent(eventParam: string | string[] | undefined): string | null {
  if (typeof eventParam !== "string") return null;
  const eventId = eventParam.trim();
  return eventId ? eventId : null;
}

export function emergencyFitEventPath(eventId: string): string {
  const params = new URLSearchParams({ event: eventId });
  return `/emergency-fit?${params.toString()}`;
}

export function eventFitContext(event: {
  id: string;
  name: string;
  occasion: string | null;
  comfortNeeds: readonly string[];
  lookId: string | null;
}): EventFitContext {
  const occasion = event.occasion?.trim() ? event.occasion.trim() : event.name.trim();
  return {
    id: event.id,
    name: event.name,
    occasion,
    comfortText: event.comfortNeeds.join("\n"),
    hasLook: Boolean(event.lookId),
  };
}

export function emergencyFitFields(event: EventFitContext | null): {
  occasion: string;
  vibe: string;
  comfortText: string;
} {
  if (!event) {
    return { occasion: "", vibe: "", comfortText: "" };
  }
  return { occasion: event.occasion, vibe: "", comfortText: event.comfortText };
}

export function attachLookPlan(input: {
  pending: boolean;
  savedLookId: string;
  hasLook: boolean;
  confirmed: boolean;
}): { status: "blocked" } | { status: "confirm" } | { status: "ready"; body: { look_id: string } } {
  if (input.pending || !input.savedLookId) return { status: "blocked" };
  if (input.hasLook && !input.confirmed) return { status: "confirm" };
  return { status: "ready", body: { look_id: input.savedLookId } };
}

export async function runAttachLook(input: {
  pending: boolean;
  savedLookId: string;
  hasLook: boolean;
  confirmed: boolean;
  fetchEvent: () => Promise<{ status: number; lookId: string | null }>;
  patchEvent: (body: { look_id: string }) => Promise<{ status: number }>;
}): Promise<
  | { status: "blocked" | "confirm" | "attached" | "missing" | "failed" | "unauthorized"; savedLookId: string }
> {
  const plan = attachLookPlan(input);
  if (plan.status === "blocked" || plan.status === "confirm") {
    return { status: plan.status, savedLookId: input.savedLookId };
  }
  if (!input.confirmed) {
    const current = await input.fetchEvent();
    if (current.status === 401) return { status: "unauthorized", savedLookId: input.savedLookId };
    if (current.status === 404) return { status: "missing", savedLookId: input.savedLookId };
    if (current.status !== 200) return { status: "failed", savedLookId: input.savedLookId };
    if (current.lookId) return { status: "confirm", savedLookId: input.savedLookId };
  }
  const patched = await input.patchEvent(plan.body);
  if (patched.status === 401) return { status: "unauthorized", savedLookId: input.savedLookId };
  if (patched.status === 404) return { status: "missing", savedLookId: input.savedLookId };
  if (patched.status !== 200) return { status: "failed", savedLookId: input.savedLookId };
  return { status: "attached", savedLookId: input.savedLookId };
}
