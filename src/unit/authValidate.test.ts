import { expect } from "chai";
import "./mocks/cxWrapper-mock";
import { initialize, getCx } from "../cx";
import { Logs } from "../models/logs";
import * as mockVscode from "./mocks/vscode-mock";

describe("Cx - authValidate", () => {
  let logs: Logs;
  let mockContext: any;

  beforeEach(() => {
    const mockOutputChannel = {
      append: () => {},
      appendLine: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
      replace: () => {},
      name: "Test",
    };

    logs = {
      info: () => {},
      error: () => {},
      output: mockOutputChannel,
      log: () => {},
      warn: () => {},
      show: () => {},
    } as Logs;

    mockContext = {
      subscriptions: [],
      secrets: mockVscode.mock.secrets, 
    };

    initialize(mockContext);
  });

  it("should return true when authentication is successful", async () => {
    const cx = getCx(); 
    const result = await cx.authValidate(logs);
    expect(result).to.be.true;
  });
});