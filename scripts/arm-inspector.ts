type JsonRpcRequest = {
  id: number;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  id?: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
};

const INSPECTOR_URL =
  process.env.BUN_INSPECTOR_WS_URL ?? "ws://127.0.0.1:9229/devtools";
const MAX_ATTEMPTS = Number(process.env.BUN_INSPECTOR_ARM_ATTEMPTS ?? "40");
const RETRY_MS = Number(process.env.BUN_INSPECTOR_ARM_RETRY_MS ?? "250");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const armOnce = async (): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(INSPECTOR_URL);
    let requestId = 0;
    const pending = new Map<number, (response: JsonRpcResponse) => void>();
    let settled = false;

    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        // Ignore close errors.
      }
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const send = (
      method: string,
      params?: Record<string, unknown>,
    ): Promise<JsonRpcResponse> => {
      return new Promise((resolveSend, rejectSend) => {
        const id = ++requestId;
        pending.set(id, resolveSend);
        const payload: JsonRpcRequest = { id, method, params };
        try {
          ws.send(JSON.stringify(payload));
        } catch (error) {
          pending.delete(id);
          rejectSend(error);
        }
      });
    };

    ws.onerror = (event) => {
      finish(new Error(`Inspector websocket error: ${String(event.type)}`));
    };

    ws.onmessage = (event) => {
      let message: JsonRpcResponse;
      try {
        message = JSON.parse(String(event.data)) as JsonRpcResponse;
      } catch (error) {
        finish(error);
        return;
      }
      if (typeof message.id === "number") {
        const resolvePending = pending.get(message.id);
        if (resolvePending) {
          pending.delete(message.id);
          resolvePending(message);
        }
      }
    };

    ws.onopen = async () => {
      try {
        const runtime = await send("Runtime.enable");
        if (runtime.error) throw new Error(runtime.error.message);

        const debuggerEnable = await send("Debugger.enable");
        if (debuggerEnable.error) throw new Error(debuggerEnable.error.message);

        const breakpoints = await send("Debugger.setBreakpointsActive", {
          active: true,
        });
        if (breakpoints.error) throw new Error(breakpoints.error.message);

        const debuggerStatements = await send(
          "Debugger.setPauseOnDebuggerStatements",
          {
            enabled: true,
          },
        );
        if (debuggerStatements.error) {
          throw new Error(debuggerStatements.error.message);
        }
        console.log("[debug:arm] Bun inspector debugger pauses enabled");
        finish();
      } catch (error) {
        finish(error);
      }
    };
  });
};

const main = async () => {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await armOnce();
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        console.error(
          `[debug:arm] failed after ${MAX_ATTEMPTS} attempts: ${String(error)}`,
        );
        process.exit(1);
      }
      await sleep(RETRY_MS);
    }
  }
};

await main();
