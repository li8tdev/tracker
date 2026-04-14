import { useState, useEffect, useCallback } from 'react';
import { getToday } from '@/lib/storage';
const SESSION_KEY = 'tracker-day-session'; // day session storage key

interface SessionState {
  active: boolean;
  startedAt: string | null;
}

export function useDaySession() {
  const [session, setSession] = useState<SessionState>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Auto-expire if started on a different day
        if (parsed.startedAt) {
          const startDay = new Date(parsed.startedAt).toISOString().split('T')[0];
          const today = getToday();
          if (startDay !== today) return { active: false, startedAt: null };
        }
        return parsed;
      }
    } catch {}
    return { active: false, startedAt: null };
  });

  useEffect(() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }, [session]);

  const startDay = useCallback(() => {
    setElapsed(0);
    setSession({ active: true, startedAt: new Date().toISOString() });
  }, []);

  const endDay = useCallback(() => {
    setElapsed(0);
    setSession({ active: false, startedAt: null });
  }, []);

  // Elapsed hours since start
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!session.active || !session.startedAt) {
      setElapsed(0);
      return;
    }
    const update = () => {
      const diff = Date.now() - new Date(session.startedAt!).getTime();
      setElapsed(Math.floor(diff / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [session.active, session.startedAt]);

  return { ...session, startDay, endDay, elapsedSeconds: elapsed };
}
