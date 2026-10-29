import { ASKING_NEMOTRON_MESSAGE } from "@/lib/ai";

export function AskingNemotron() {
  return (
    <div className="asking-nemotron" role="status">
      <span className="asking-nemotron-spinner" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm font-semibold text-primary">{ASKING_NEMOTRON_MESSAGE}</p>
        <span className="asking-skeleton" aria-hidden="true" />
      </div>
    </div>
  );
}
