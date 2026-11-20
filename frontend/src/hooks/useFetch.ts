import { useCallback, useEffect, useRef, useState } from "react";

import { getErrorMessage } from "../api/client";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useFetch<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [version, setVersion] = useState(0);
  const loadRef = useRef(load);
  const requestId = useRef(0);

  loadRef.current = load;

  useEffect(() => {
    const id = ++requestId.current;
    setState((previous) => ({ data: previous.data, loading: true, error: null }));

    loadRef.current().then(
      (data) => {
        if (requestId.current === id) setState({ data, loading: false, error: null });
      },
      (error: unknown) => {
        if (requestId.current === id) {
          setState((previous) => ({
            data: previous.data,
            loading: false,
            error: getErrorMessage(error),
          }));
        }
      },
    );

    return () => {
      requestId.current += 1;
    };
  }, [...deps, version]);

  const refetch = useCallback(() => setVersion((value) => value + 1), []);

  return { ...state, refetch };
}
