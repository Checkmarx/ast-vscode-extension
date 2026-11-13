/* eslint-disable @typescript-eslint/no-explicit-any */
import * as sinon from "sinon";
import * as vscode from "vscode";
import { getCx, initialize } from "../../cx";
import { TelemetryPayload } from "../../models/telemetryEvent";

/** In-memory globalState for unit tests. */
export function createMemoryGlobalState(): vscode.Memento & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    keys: () => Array.from(data.keys()),
    get: (key: string, defaultValue?: unknown) => (data.has(key) ? data.get(key) : defaultValue),
    update: async (key: string, value: unknown) => {
      if (value === undefined) {
        data.delete(key);
      } else {
        data.set(key, value);
      }
    },
  } as any;
}

export function createTestContext(version = "2.74.0"): vscode.ExtensionContext {
  return {
    subscriptions: [],
    globalState: createMemoryGlobalState(),
    extensionPath: "/test",
    extension: { packageJSON: { version } },
    secrets: {
      get: sinon.stub().resolves("test-token"),
      store: sinon.stub().resolves(),
      delete: sinon.stub().resolves(),
    },
  } as any;
}

/**
 * Stubs sendTelemetryEvent on the shared cx instance (initializing it if needed)
 * and returns the stub, so tests can inspect the payloads.
 */
export function stubSendTelemetry(sandbox: sinon.SinonSandbox, delivered = true): sinon.SinonStub<[TelemetryPayload], Promise<boolean>> {
  let instance: any;
  try {
    instance = getCx();
  } catch {
    initialize(createTestContext());
    instance = getCx();
  }
  return sandbox.stub(instance, "sendTelemetryEvent").resolves(delivered) as any;
}

/** Waits for fire-and-forget promises to settle. */
export async function flushPromises(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
