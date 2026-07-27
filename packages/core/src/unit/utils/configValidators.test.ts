/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import { validateConfigurationAndLicense } from "../../utils/common/configValidators";
import { cx, initialize as initializeCx } from "../../cx";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("configValidators", () => {
  let sandbox: sinon.SinonSandbox;
  let logs: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    initializeCx({ subscriptions: [] } as any);
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    });
    logs = {
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
    };
  });

  afterEach(() => {
    resetExtensionConfig();
    sandbox.restore();
  });

  describe("validateConfigurationAndLicense", () => {
    it("returns false when configuration is invalid (and does not check standalone)", async () => {
      const validStub = sandbox.stub(cx, "isValidConfiguration").resolves(false);
      const standaloneStub = sandbox.stub(cx, "isStandaloneEnabled").resolves(false);

      const result = await validateConfigurationAndLicense(logs);

      expect(result).to.be.false;
      expect(validStub.calledOnce).to.be.true;
      expect(standaloneStub.called).to.be.false;
    });

    it("returns false when configuration is valid but standalone mode is enabled", async () => {
      sandbox.stub(cx, "isValidConfiguration").resolves(true);
      const standaloneStub = sandbox.stub(cx, "isStandaloneEnabled").resolves(true);

      const result = await validateConfigurationAndLicense(logs);

      expect(result).to.be.false;
      expect(standaloneStub.calledOnceWith(logs)).to.be.true;
    });

    it("returns true when configuration is valid and standalone mode is disabled", async () => {
      sandbox.stub(cx, "isValidConfiguration").resolves(true);
      sandbox.stub(cx, "isStandaloneEnabled").resolves(false);

      const result = await validateConfigurationAndLicense(logs);

      expect(result).to.be.true;
    });
  });
});
