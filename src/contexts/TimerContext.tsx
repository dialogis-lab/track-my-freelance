import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TimerContextType {
  timerUpdated: number;
  triggerTimerUpdate: () => void;
}

const TimerContext = createContext<TimerContextType | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timerUpdated, setTimerUpdated] = useState(0);

  const triggerTimerUpdate = () => {
    setTimerUpdated(prev => prev + 1);
  };

  return (
    <TimerContext.Provider value={{ timerUpdated, triggerTimerUpdate }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimerContext() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimerContext must be used within a TimerProvider');
  }
  return context;
}