/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import {
  isCopilotInstalled,
  isClaudeInstalled,
  hasAnySupportedAiExtension,
  getSelectedConfigFor,
} from "../../utils/aiAssistantUtil";
import { constants } from "../../utils/common/constants";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("aiAssistantUtil", () => {
  let sandbox: sinon.SinonSandbox;
  let getExtensionStub: sinon.SinonStub;

  // Build a getExtension stub that "installs" the given extension ids.
  const installExtensions = (...ids: string[]) => {
    getExtensionStub.callsFake((id: string) =>
      ids.includes(id) ? ({ id } as any) : undefined
    );
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    });
    getExtensionStub = sandbox.stub(vscode.extensions, "getExtension").returns(undefined);
  });

  afterEach(() => {
    resetExtensionConfig();
    sandbox.restore();
  });

  describe("isCopilotInstalled", () => {
    it("returns true when copilot chat extension is present", () => {
      installExtensions(constants.copilotChatExtensionId);
      expect(isCopilotInstalled()).to.be.true;
    });

    it("returns false when copilot chat extension is absent", () => {
      expect(isCopilotInstalled()).to.be.false;
    });
  });

  describe("isClaudeInstalled", () => {
    it("returns true when claude extension is present", () => {
      installExtensions(constants.claudeChatExtensionId);
      expect(isClaudeInstalled()).to.be.true;
    });

    it("returns false when claude extension is absent", () => {
      expect(isClaudeInstalled()).to.be.false;
    });
  });

  describe("hasAnySupportedAiExtension", () => {
    it("returns false when none of the supported extensions are installed", () => {
      expect(hasAnySupportedAiExtension()).to.be.false;
    });

    it("returns true when only Copilot is installed", () => {
      installExtensions(constants.copilotChatExtensionId);
      expect(hasAnySupportedAiExtension()).to.be.true;
    });

    it("returns true when only Gemini is installed", () => {
      installExtensions(constants.geminiChatExtensionId);
      expect(hasAnySupportedAiExtension()).to.be.true;
    });

    it("returns true when only Claude is installed", () => {
      installExtensions(constants.claudeChatExtensionId);
      expect(hasAnySupportedAiExtension()).to.be.true;
    });
  });

  describe("getSelectedConfigFor", () => {
    it("maps 'Copilot' to the copilot extension id", () => {
      expect(getSelectedConfigFor("Copilot")).to.deep.equal({
        extensionId: constants.copilotChatExtensionId,
      });
    });

    it("maps 'Gemini' to the gemini extension id", () => {
      expect(getSelectedConfigFor("Gemini")).to.deep.equal({
        extensionId: constants.geminiChatExtensionId,
      });
    });

    it("maps 'Claude' to the claude extension id", () => {
      expect(getSelectedConfigFor("Claude")).to.deep.equal({
        extensionId: constants.claudeChatExtensionId,
      });
    });

    it("trims surrounding whitespace before matching", () => {
      expect(getSelectedConfigFor("  Copilot  ")).to.deep.equal({
        extensionId: constants.copilotChatExtensionId,
      });
    });

    it("returns undefined for an empty / whitespace-only name", () => {
      expect(getSelectedConfigFor("")).to.be.undefined;
      expect(getSelectedConfigFor("   ")).to.be.undefined;
    });

    it("returns undefined for an unknown / custom assistant name", () => {
      expect(getSelectedConfigFor("SomeCustomAssistant")).to.be.undefined;
    });
  });
});
