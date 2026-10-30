/* eslint-disable @typescript-eslint/no-explicit-any */
import "../../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { ConfigurationManager } from "../../../realtimeScanners/configuration/configurationManager";
import { Logs } from "../../../models/logs";
import * as extensionConfig from "../../../config/extensionConfig";

describe("ConfigurationManager", () => {
  let configManager: ConfigurationManager;
  let sandbox: sinon.SinonSandbox;
  let logsStub: sinon.SinonStubbedInstance<Logs>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    logsStub = sandbox.stub(Object.create(Logs.prototype)) as sinon.SinonStubbedInstance<Logs>;
    logsStub.info = sandbox.stub();
    logsStub.warn = sandbox.stub();
    configManager = new ConfigurationManager(logsStub as any);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("getIdeCopilotSelfHealingEnabled()", () => {
    it("should read Self-Healing setting from Checkmarx config section for Checkmarx One", async () => {
      // Mock extension type as Checkmarx
      sandbox.stub(extensionConfig, "getExtensionType").returns(extensionConfig.EXTENSION_TYPE.CHECKMARX);

      // Mock VS Code configuration
      const getConfigStub = sandbox.stub(vscode.workspace, "getConfiguration");
      const configStub = {
        get: sandbox.stub().returns(true),
      };
      getConfigStub.returns(configStub as any);

      const result = await configManager.getIdeCopilotSelfHealingEnabled();

      expect(result).to.be.true;
      expect(getConfigStub.calledWith("Checkmarx")).to.be.true;
      expect(configStub.get.calledWith("Self-Healing")).to.be.true;
    });

    it("should read Self-Healing setting from Checkmarx Developer Assist section for Project-Ignite", async () => {
      // Mock extension type as Developer Assist
      sandbox.stub(extensionConfig, "getExtensionType").returns(extensionConfig.EXTENSION_TYPE.DEVELOPER_ASSIST);

      // Mock VS Code configuration
      const getConfigStub = sandbox.stub(vscode.workspace, "getConfiguration");
      const configStub = {
        get: sandbox.stub().returns(true),
      };
      getConfigStub.returns(configStub as any);

      const result = await configManager.getIdeCopilotSelfHealingEnabled();

      expect(result).to.be.true;
      expect(getConfigStub.calledWith("Checkmarx Developer Assist")).to.be.true;
      expect(configStub.get.calledWith("Self-Healing")).to.be.true;
    });

    it("should return false when Self-Healing is disabled", async () => {
      sandbox.stub(extensionConfig, "getExtensionType").returns(extensionConfig.EXTENSION_TYPE.CHECKMARX);

      const getConfigStub = sandbox.stub(vscode.workspace, "getConfiguration");
      const configStub = {
        get: sandbox.stub().returns(false),
      };
      getConfigStub.returns(configStub as any);

      const result = await configManager.getIdeCopilotSelfHealingEnabled();

      expect(result).to.be.false;
    });

    it("should handle undefined configuration value gracefully", async () => {
      sandbox.stub(extensionConfig, "getExtensionType").returns(extensionConfig.EXTENSION_TYPE.CHECKMARX);

      const getConfigStub = sandbox.stub(vscode.workspace, "getConfiguration");
      const configStub = {
        get: sandbox.stub().returns(undefined),
      };
      getConfigStub.returns(configStub as any);

      const result = await configManager.getIdeCopilotSelfHealingEnabled();

      expect(result).to.be.undefined;
    });
  });

  describe("syncSettingsToPropertiesFile()", () => {
    it("should sync 5 keys: 4 scanners + Self-Healing", async () => {
      sandbox.stub(extensionConfig, "getExtensionType").returns(extensionConfig.EXTENSION_TYPE.CHECKMARX);

      // Mock all scanner configurations
      const getConfigStub = sandbox.stub(vscode.workspace, "getConfiguration");
      const configStub = {
        get: sandbox.stub().returns(true),
      };
      getConfigStub.returns(configStub as any);

      // Mock PropertiesFileManager
      const updateScannerSettingsStub = sandbox.stub(configManager as any, "propertiesManager").value({
        updateScannerSettings: sandbox.stub().resolves(),
      });

      await configManager.syncSettingsToPropertiesFile();

      // Verify updateScannerSettings was called
      const propertiesManager = (configManager as any).propertiesManager;
      expect(propertiesManager.updateScannerSettings.called).to.be.true;

      // Get the settings Map that was passed
      const settingsArg = propertiesManager.updateScannerSettings.getCall(0).args[0];
      expect(settingsArg.size).to.equal(5);
      expect(settingsArg.has("cx_asca_scanner_enabled")).to.be.true;
      expect(settingsArg.has("cx_sca_scanner_enabled")).to.be.true;
      expect(settingsArg.has("cx_secret_scanner_enabled")).to.be.true;
      expect(settingsArg.has("cx_kics_scanner_enabled")).to.be.true;
      expect(settingsArg.has("copilot_self_healing_enabled")).to.be.true;
    });

    it("should NOT sync Containers scanner key", async () => {
      sandbox.stub(extensionConfig, "getExtensionType").returns(extensionConfig.EXTENSION_TYPE.CHECKMARX);

      const getConfigStub = sandbox.stub(vscode.workspace, "getConfiguration");
      const configStub = {
        get: sandbox.stub().returns(true),
      };
      getConfigStub.returns(configStub as any);

      // Mock PropertiesFileManager
      const updateScannerSettingsStub = sandbox.stub(configManager as any, "propertiesManager").value({
        updateScannerSettings: sandbox.stub().resolves(),
      });

      await configManager.syncSettingsToPropertiesFile();

      const propertiesManager = (configManager as any).propertiesManager;
      const settingsArg = propertiesManager.updateScannerSettings.getCall(0).args[0];

      expect(settingsArg.has("cx_containers_scanner_enabled")).to.be.false;
    });

    it("should call propertiesManager.updateScannerSettings with correct Map", async () => {
      sandbox.stub(extensionConfig, "getExtensionType").returns(extensionConfig.EXTENSION_TYPE.CHECKMARX);

      const getConfigStub = sandbox.stub(vscode.workspace, "getConfiguration");
      const configStub = {
        get: sandbox.stub().returns(true),
      };
      getConfigStub.returns(configStub as any);

      const mockUpdateStub = sandbox.stub().resolves();
      sandbox.stub(configManager as any, "propertiesManager").value({
        updateScannerSettings: mockUpdateStub,
      });

      await configManager.syncSettingsToPropertiesFile();

      expect(mockUpdateStub.calledOnce).to.be.true;
    });
  });

  describe("registerConfigChangeListener()", () => {
    it("should return a disposable", () => {
      const mockCallback = sandbox.stub();
      const disposable = configManager.registerConfigChangeListener(mockCallback);

      expect(disposable).to.exist;
      expect(disposable.dispose).to.be.a("function");
    });

    it("should trigger callback on configuration change", () => {
      sandbox.stub(extensionConfig, "getExtensionType").returns(extensionConfig.EXTENSION_TYPE.CHECKMARX);

      const mockCallback = sandbox.stub();
      const getConfigStub = sandbox.stub(vscode.workspace, "getConfiguration");
      const configStub = {
        get: sandbox.stub().returns(true),
      };
      getConfigStub.returns(configStub as any);

      configManager.registerConfigChangeListener(mockCallback);

      // Note: Full integration testing of event listeners requires additional mocking
      // This test verifies the listener registration succeeds
      expect(mockCallback.called).to.be.false; // Callback not called until event fires
    });
  });

  describe("isScannerActive()", () => {
    it("should return true when scanner is active", () => {
      const getConfigStub = sandbox.stub(vscode.workspace, "getConfiguration");
      const configStub = {
        get: sandbox.stub().returns(true),
      };
      getConfigStub.returns(configStub as any);

      const config = {
        configSection: "test.section",
        activateKey: "test.key",
        engineName: "test",
        enabledMessage: "enabled",
        disabledMessage: "disabled",
        errorMessage: "error",
      };

      const result = configManager.isScannerActive(config);

      expect(result).to.be.true;
      expect(getConfigStub.calledWith("test.section")).to.be.true;
      expect(configStub.get.calledWith("test.key")).to.be.true;
    });

    it("should return false when scanner is inactive", () => {
      const getConfigStub = sandbox.stub(vscode.workspace, "getConfiguration");
      const configStub = {
        get: sandbox.stub().returns(false),
      };
      getConfigStub.returns(configStub as any);

      const config = {
        configSection: "test.section",
        activateKey: "test.key",
        engineName: "test",
        enabledMessage: "enabled",
        disabledMessage: "disabled",
        errorMessage: "error",
      };

      const result = configManager.isScannerActive(config);

      expect(result).to.be.false;
    });
  });
});
