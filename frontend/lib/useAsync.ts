import { useCallback, useEffect, useState } from "react";
import { errorText } from "./api";

type AsyncState<T> = {
  data: T | undefined;
  error: string | null;
  /** Loads again, e.g. after an error. */
  reload: () => void;
};

/**
 * Runs `load` when it changes (wrap it in useCallback) and tracks its result. Results that arrive
 * after the component unmounted or `load` changed are ignored.
 */
export function useAsync<T>(load: () => Promise<T>): AsyncState<T> {
  const [state, setState] = useState<{ data?: T; error: string | null }>({ error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    load()
      .then((data) => active && setState({ data, error: null }))
      .catch((error) => active && setState((current) => ({ ...current, error: errorText(error) })));
    return () => {
      active = false;
    };
  }, [load, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { data: state.data, error: state.error, reload };
}
