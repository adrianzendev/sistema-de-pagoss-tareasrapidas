import { QueryClient, QueryFunction } from "@tanstack/react-query";

function dispatchSessionExpired() {
  window.dispatchEvent(new Event("session-expired"));
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      dispatchSessionExpired();
    }
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.message || text || res.statusText);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(text || res.statusText || `Error ${res.status}`);
      }
      throw e;
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (res.status === 401) {
      dispatchSessionExpired();
      if (unauthorizedBehavior === "returnNull") return null;
    }

    await throwIfResNotOk(res);

    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
