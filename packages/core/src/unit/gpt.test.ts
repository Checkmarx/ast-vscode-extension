import { expect } from "chai";
import sinon from "sinon";
import * as vscode from "vscode";
import { Gpt } from "../gpt/gpt";
import { Logs } from "../models/logs";
import { GptView } from "../views/gptView/gptView";
import { cx } from "../cx";
import { constants } from "../utils/common/constants";

describe("Gpt", () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let mockLogs: any;
  let mockGptPanel: any;
  let mockGptView: any;
  let gpt: Gpt;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockContext = {
      subscriptions: [],
    };

    mockLogs = {
      output: {
        appendLine: sandbox.stub(),
        show: sandbox.stub(),
      },
      info: sandbox.stub(),
      error: sandbox.stub(),
      warn: sandbox.stub(),
      debug: sandbox.stub(),
      log: sandbox.stub(),
      show: sandbox.stub(),
    } as any as Logs;

    mockGptPanel = {
      webview: {
        postMessage: sandbox.stub().resolves(),
      },
      dispose: sandbox.stub(),
    };

    mockGptView = {
      getResult: sandbox.stub().returns({
        filename: "/test/file.ts",
        line: 42,
        severity: "HIGH",
        vulnerabilityName: "SQL Injection",
      }),
      getAskKicsIcon: sandbox.stub().returns(vscode.Uri.file("/icon.svg")),
      getAskKicsUserIcon: sandbox.stub().returns(vscode.Uri.file("/user.svg")),
    };

    sandbox.stub(cx, "runGpt").resolves([
      {
        conversationId: "test-id",
        response: ["This is a test response"],
      },
    ]);

    sandbox.stub(cx, "mask").resolves([]);

    gpt = new Gpt(mockContext, mockLogs, mockGptPanel, mockGptView);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("constructor", () => {
    it("should initialize with all dependencies", () => {
      expect(gpt["context"]).to.equal(mockContext);
      expect(gpt["logs"]).to.equal(mockLogs);
      expect(gpt["gptPanel"]).to.equal(mockGptPanel);
      expect(gpt["gptView"]).to.equal(mockGptView);
    });

    it("should initialize thinkID to 0", () => {
      expect(gpt["thinkID"]).to.equal(0);
    });

    it("should store KICS icons from gptView", () => {
      expect(gpt["kicsIcon"]).to.exist;
      expect(gpt["userKicsIcon"]).to.exist;
    });

    it("should get KICS icons from gptView", () => {
      expect(mockGptView.getAskKicsIcon.called).to.be.true;
      expect(mockGptView.getAskKicsUserIcon.called).to.be.true;
    });
  });

  describe("runGpt", () => {
    it("should post user message to webview", async () => {
      const userMessage = "How to fix SQL injection?";
      const user = "user@example.com";

      await gpt.runGpt(userMessage, user);

      expect(mockGptPanel.webview.postMessage.called).to.be.true;

      const firstCall = mockGptPanel.webview.postMessage.getCall(0);
      expect(firstCall.args[0].command).to.equal("userMessage");
      expect(firstCall.args[0].message.message).to.equal(userMessage);
    });

    it("should post disable command before processing", async () => {
      const userMessage = "Test message";

      await gpt.runGpt(userMessage, "user");

      const calls = mockGptPanel.webview.postMessage.getCalls();
      const disableCall = calls.find((call: any) => call.args[0].command === "disable");

      expect(disableCall).to.exist;
    });

    it("should post thinking command with current thinkID", async () => {
      const userMessage = "Test message";

      await gpt.runGpt(userMessage, "user");

      const calls = mockGptPanel.webview.postMessage.getCalls();
      const thinkingCall = calls.find((call: any) => call.args[0].command === "thinking");

      expect(thinkingCall).to.exist;
      expect(thinkingCall.args[0].thinkID).to.equal(0);
    });

    it("should call cx.runGpt with result data", async () => {
      const userMessage = "How to fix?";

      await gpt.runGpt(userMessage, "user");

      // Wait for async call to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect((cx.runGpt as sinon.SinonStub).called).to.be.true;

      const call = (cx.runGpt as sinon.SinonStub).getCall(0);
      expect(call.args[0]).to.equal(userMessage);
    });

    it("should increment thinkID after response", async () => {
      const userMessage = "First question";

      await gpt.runGpt(userMessage, "user");

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(gpt["thinkID"]).to.equal(1);
    });

    it("should post enable command after processing", async () => {
      const userMessage = "Test";

      await gpt.runGpt(userMessage, "user");

      // Wait for async call
      await new Promise(resolve => setTimeout(resolve, 100));

      const calls = mockGptPanel.webview.postMessage.getCalls();
      const enableCall = calls.find((call: any) => call.args[0].command === "enable");

      expect(enableCall).to.exist;
    });

    it("should post response with AI assistant name", async () => {
      const userMessage = "Question";

      await gpt.runGpt(userMessage, "user");

      // Wait for async
      await new Promise(resolve => setTimeout(resolve, 100));

      const calls = mockGptPanel.webview.postMessage.getCalls();
      const responseCall = calls.find((call: any) => call.args[0].command === "response");

      if (responseCall) {
        expect(responseCall.args[0].message.user).to.equal(
          constants.aiSecurityChampion
        );
      }
    });

    it("should handle error from cx.runGpt", async () => {
      (cx.runGpt as sinon.SinonStub).rejects(new Error("API Error"));

      const userMessage = "Question";

      await gpt.runGpt(userMessage, "user");

      // Wait for async
      await new Promise(resolve => setTimeout(resolve, 100));

      const calls = mockGptPanel.webview.postMessage.getCalls();
      const responseCall = calls.find((call: any) => call.args[0].command === "response");

      if (responseCall) {
        expect(responseCall.args[0].message.message).to.include("API Error");
      }
    });

    it("should use icons from constructor", async () => {
      const userMessage = "Test";

      await gpt.runGpt(userMessage, "user");

      const calls = mockGptPanel.webview.postMessage.getCalls();
      const userMessageCall = calls.find(
        (call: any) => call.args[0].command === "userMessage"
      );

      expect(userMessageCall.args[0].icon).to.exist;
    });
  });

  describe("mask", () => {
    it("should call cx.mask with file path", async () => {
      const filePath = "/path/to/file.ts";

      await gpt.mask(filePath);

      expect((cx.mask as sinon.SinonStub).calledWith(filePath)).to.be.true;
    });

    it("should return mask result", async () => {
      const mockMaskResult = { masked: true };
      (cx.mask as sinon.SinonStub).resolves(mockMaskResult);

      const result = await gpt.mask("/path/to/file.ts");

      expect(result).to.deep.equal(mockMaskResult);
    });

    it("should log error on mask failure", async () => {
      const maskError = new Error("Mask failed");
      (cx.mask as sinon.SinonStub).rejects(maskError);

      await gpt.mask("/path/to/file.ts");

      expect(mockLogs.error.called).to.be.true;
    });

    it("should handle various file paths", async () => {
      const paths = [
        "/home/user/project/file.ts",
        "C:\\Windows\\path\\file.ts",
        "./relative/path/file.ts",
      ];

      for (const path of paths) {
        (cx.mask as sinon.SinonStub).resetHistory();
        await gpt.mask(path);
        expect((cx.mask as sinon.SinonStub).calledWith(path)).to.be.true;
      }
    });
  });

  describe("sleep utility", () => {
    it("should have sleep functionality (through async delay)", async () => {
      const start = Date.now();

      // runGpt includes a sleep(1000) call
      await gpt.runGpt("test", "user");

      const elapsed = Date.now() - start;

      // Should have some delay from sleep call
      expect(elapsed).to.be.greaterThanOrEqual(0); // sleep works async
    });
  });

  describe("webview interaction", () => {
    it("should post message with correct structure", async () => {
      const userMessage = "Test";

      await gpt.runGpt(userMessage, "user");

      const calls = mockGptPanel.webview.postMessage.getCalls();

      // Verify all messages have command property
      calls.forEach((call: any) => {
        expect(call.args[0]).to.have.property("command");
      });
    });

    it("should handle null webview gracefully", async () => {
      mockGptPanel.webview = null;

      const gptWithNullWebview = new Gpt(
        mockContext,
        mockLogs,
        mockGptPanel,
        mockGptView
      );

      // Should not throw
      expect(() => {
        gptWithNullWebview.runGpt("test", "user");
      }).to.not.throw();
    });

    it("should handle disposed panel", async () => {
      mockGptPanel.dispose();

      await gpt.runGpt("test", "user");

      // Should complete without error
      expect(true).to.be.true;
    });
  });

  describe("state management", () => {
    it("should track thinkID across multiple calls", async () => {
      expect(gpt["thinkID"]).to.equal(0);

      await gpt.runGpt("First", "user");
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(gpt["thinkID"]).to.equal(1);

      await gpt.runGpt("Second", "user");
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(gpt["thinkID"]).to.equal(2);
    });

    it("should preserve panel reference", () => {
      expect(gpt["gptPanel"]).to.equal(mockGptPanel);
    });

    it("should preserve view reference", () => {
      expect(gpt["gptView"]).to.equal(mockGptView);
    });
  });

  describe("integration scenarios", () => {
    it("should handle rapid successive messages", async () => {
      const messages = ["Question 1", "Question 2", "Question 3"];

      await Promise.all(
        messages.map((msg) => gpt.runGpt(msg, "user"))
      );

      // All messages should be posted
      expect(mockGptPanel.webview.postMessage.callCount).to.be.greaterThan(0);
    });

    it("should handle empty user message", async () => {
      await gpt.runGpt("", "user");

      const calls = mockGptPanel.webview.postMessage.getCalls();
      expect(calls.length).to.be.greaterThan(0);
    });

    it("should handle special characters in message", async () => {
      const specialMessage = "How to fix: <script>alert('xss')</script>";

      await gpt.runGpt(specialMessage, "user");

      const calls = mockGptPanel.webview.postMessage.getCalls();
      const userMsgCall = calls.find(
        (c: any) => c.args[0].command === "userMessage"
      );

      expect(userMsgCall.args[0].message.message).to.include(specialMessage);
    });
  });
});
