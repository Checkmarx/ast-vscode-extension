import { expect } from "chai";
import "./mocks/vscode-mock";
import "./mocks/cxWrapper-mock";
import { cx } from "../cx";
import { Logs } from "../models/logs";

describe("Cx - authValidate", () => {
  let logs: Logs;


  beforeEach(() => {
    const mockOutputChannel = {
      append: () => {},
      appendLine: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
      replace: () => {},
      name: "Test"
    };

    logs = {
      info: () => {},
      error: () => {},
      output: mockOutputChannel,
      log: () => {},
      warn: () => {},
      show: () => {}
    } as Logs;
  });

  it("should return true when authentication is successful", async () => {
    // Using valid API key from vscode mock
    const result = await cx.authValidate(logs);
    expect(result).to.be.true;
  });

  
}); 