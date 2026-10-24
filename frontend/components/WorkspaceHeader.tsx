import type { ReactNode } from "react";

type Props = {
  kicker: string;
  title: string;
  kickerClassName?: string;
  children?: ReactNode;
};

export function WorkspaceHeader({ kicker, title, kickerClassName, children }: Props) {
  return (
    <header className="mb-6 flex max-w-3xl min-w-0 flex-col gap-2">
      <p className={["text-xs font-semibold uppercase tracking-[0.16em]", kickerClassName ?? "text-primary"].join(" ")}>
        {kicker}
      </p>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground break-words sm:text-3xl">
        {title}
      </h1>
      {children}
    </header>
  );
}
