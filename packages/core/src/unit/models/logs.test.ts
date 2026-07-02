import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import { Logs } from "../../models/logs";

describe("Logs", () => {
  let output: { appendLine: sinon.SinonStub; show: sinon.SinonStub };
  let logs: Logs;

  beforeEach(() => {
    output = { appendLine: sinon.stub(), show: sinon.stub() };
    logs = new Logs(output as any);
  });

  it("should log info messages", () => {
    logs.info("hello");
    expect(output.appendLine.calledOnce).to.be.true;
    expect(output.appendLine.firstCall.args[0]).to.include("[INFO");
    expect(output.appendLine.firstCall.args[0]).to.include("hello");
  });

  it("should log debug messages", () => {
    logs.debug("debug msg");
    expect(output.appendLine.firstCall.args[0]).to.include("[DEBUG");
  });

  it("should log warn messages", () => {
    logs.warn("warn msg");
    expect(output.appendLine.firstCall.args[0]).to.include("[WARN");
  });

  it("should log error messages", () => {
    logs.error("error msg");
    expect(output.appendLine.firstCall.args[0]).to.include("[ERROR");
  });

  it("should show output channel", () => {
    logs.show();
    expect(output.show.calledOnce).to.be.true;
  });
});
