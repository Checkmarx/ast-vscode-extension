import "../mocks/vscode-mock";
import { expect } from "chai";
import { applyDefaultScannerSettingsOnce, SCANNERS_INITIALIZED_KEY } from "../../utils/scannerDefaults";

const KEYS = ["a.asca", "a.oss", "a.secrets", "a.iac", "a.containers"];

function makeConfig(globalValues: Record<string, boolean | undefined>) {
  const updates: Array<[string, unknown]> = [];
  const config: any = {
    inspect: (key: string) => ({ key, globalValue: globalValues[key] }),
    update: (key: string, value: unknown) => {
      updates.push([key, value]);
      globalValues[key] = value as boolean;
      return Promise.resolve();
    },
  };
  return { config, updates };
}

function makeContext(initialized?: boolean) {
  const state: Record<string, unknown> = { [SCANNERS_INITIALIZED_KEY]: initialized };
  return {
    state,
    context: {
      globalState: {
        get: (key: string, def?: unknown) => (state[key] === undefined ? def : state[key]),
        update: (key: string, value: unknown) => {
          state[key] = value;
          return Promise.resolve();
        },
      },
    } as any,
  };
}

describe("applyDefaultScannerSettingsOnce", () => {
  it("turns ON every scanner the user never set when AI is enabled, and marks the install initialized", async () => {
    const { config, updates } = makeConfig({});
    const { context, state } = makeContext();

    await applyDefaultScannerSettingsOnce(context, config, KEYS, true);

    expect(updates).to.deep.equal(KEYS.map(k => [k, true]));
    expect(state[SCANNERS_INITIALIZED_KEY]).to.equal(true);
  });

  it("never changes a scanner the user set, ON or OFF", async () => {
    const { config, updates } = makeConfig({ "a.asca": false, "a.oss": true });
    const { context } = makeContext();

    await applyDefaultScannerSettingsOnce(context, config, KEYS, true);

    expect(updates.map(u => u[0])).to.deep.equal(["a.secrets", "a.iac", "a.containers"]);
  });

  it("does nothing when AI is disabled, and leaves the install uninitialized", async () => {
    const { config, updates } = makeConfig({ "a.asca": true });
    const { context, state } = makeContext();

    await applyDefaultScannerSettingsOnce(context, config, KEYS, false);

    expect(updates).to.be.empty;
    expect(state[SCANNERS_INITIALIZED_KEY]).to.equal(undefined);
  });

  it("does nothing once the install is initialized, so later choices survive", async () => {
    const { config, updates } = makeConfig({});
    const { context } = makeContext(true);

    await applyDefaultScannerSettingsOnce(context, config, KEYS, true);

    expect(updates).to.be.empty;
  });
});
