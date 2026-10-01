/**
 * Standalone typed RPC client (replaces `@hatch/space-sdk/client`).
 *
 * POSTs `{ action, args }` to `/api/actions` and returns the typed JSON
 * response. Types flow from `server/src/actions.ts` via `import type`,
 * so the client bundle never includes server runtime code.
 */
import type { z } from "zod";

type ActionShape = { request: z.ZodType; response: z.ZodType };

export type ActionClient<A extends Record<string, ActionShape>> = {
  [K in keyof A]: (args: z.infer<A[K]["request"]>) => Promise<z.infer<A[K]["response"]>>;
};

export type ApiRequest<
  C extends Record<string, (args: never) => Promise<unknown>>,
  K extends keyof C,
> = Parameters<C[K]>[0];

export type ApiResponse<
  C extends Record<string, (args: never) => Promise<unknown>>,
  K extends keyof C,
> = Awaited<ReturnType<C[K]>>;

export class ActionError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ActionError";
    this.status = status;
  }
}

export function createActionClient<A extends Record<string, ActionShape>>(
  endpoint = "/api/actions",
): ActionClient<A> {
  const call = async (action: string, args: unknown): Promise<unknown> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, args }),
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      // non-JSON response
    }
    if (!res.ok) {
      throw new ActionError(
        (body && typeof body.error === "string" ? body.error : `Request failed (${res.status})`),
        res.status,
      );
    }
    return body;
  };
  return new Proxy({} as ActionClient<A>, {
    get: (_target, name: string) => {
      if (name === "then") return undefined;
      return (args: unknown) => call(name, args);
    },
  });
}
