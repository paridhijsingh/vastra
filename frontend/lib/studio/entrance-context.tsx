"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type EntranceContextValue = {
  visible: boolean;
  swinging: boolean;
  openDoors: () => void;
  skipIntro: () => void;
  replayEntrance: () => void;
};

const EntranceContext = createContext<EntranceContextValue | null>(null);

export function EntranceProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [swinging, setSwinging] = useState(false);

  const finish = useCallback(() => {
    setSwinging(false);
    setVisible(false);
  }, []);

  const openDoors = useCallback(() => {
    if (!visible || swinging) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      finish();
      return;
    }
    setSwinging(true);
    window.setTimeout(finish, 1250);
  }, [finish, swinging, visible]);

  const skipIntro = useCallback(() => {
    finish();
  }, [finish]);

  const replayEntrance = useCallback(() => {
    setSwinging(false);
    setVisible(true);
  }, []);

  const value = useMemo(
    () => ({ visible, swinging, openDoors, skipIntro, replayEntrance }),
    [visible, swinging, openDoors, skipIntro, replayEntrance],
  );

  return <EntranceContext.Provider value={value}>{children}</EntranceContext.Provider>;
}

export function useEntrance(): EntranceContextValue {
  const value = useContext(EntranceContext);
  if (!value) {
    throw new Error("useEntrance must be used within EntranceProvider");
  }
  return value;
}
