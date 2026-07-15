import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { ContextKey } from "../../utils/listener/contextKey";

describe("ContextKey", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(vscode.commands, "executeCommand").resolves();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should set context and return true on first value", () => {
    const key = new ContextKey("test.context");
    expect(key.set(true)).to.be.true;
    expect((vscode.commands.executeCommand as sinon.SinonStub).calledWith("setContext", "test.context", true)).to.be.true;
  });

  it("should return false when value unchanged", () => {
    const key = new ContextKey("test.context");
    key.set(true);
    (vscode.commands.executeCommand as sinon.SinonStub).resetHistory();
    expect(key.set(true)).to.be.false;
    expect((vscode.commands.executeCommand as sinon.SinonStub).called).to.be.false;
  });

  it("should update context when value changes", () => {
    const key = new ContextKey("test.context");
    key.set(true);
    expect(key.set(false)).to.be.true;
    expect((vscode.commands.executeCommand as sinon.SinonStub).lastCall.args).to.deep.equal(["setContext", "test.context", false]);
  });
});
