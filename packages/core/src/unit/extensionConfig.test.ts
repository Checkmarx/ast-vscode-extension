import { expect } from "chai";
import {
  setExtensionConfig,
  getExtensionConfig,
  resetExtensionConfig,
  getCommandPrefix,
  getExtensionId,
  getExtensionType,
  isConfigured,
  EXTENSION_TYPE,
  type ExtensionConfig,
} from "../config/extensionConfig";

describe("ExtensionConfig", () => {
  afterEach(() => {
    resetExtensionConfig();
  });

  describe("setExtensionConfig and getExtensionConfig", () => {
    it("should set and retrieve configuration", () => {
      const config: ExtensionConfig = {
        extensionId: "test-extension",
        commandPrefix: "test-prefix",
        viewContainerPrefix: "test-view",
        displayName: "Test Extension",
        extensionType: EXTENSION_TYPE.CHECKMARX,
      };

      setExtensionConfig(config);
      const retrieved = getExtensionConfig();

      expect(retrieved).to.deep.equal(config);
    });

    it("should overwrite existing configuration with warning", () => {
      const config1: ExtensionConfig = {
        extensionId: "ext-1",
        commandPrefix: "prefix-1",
        viewContainerPrefix: "view-1",
        displayName: "Extension 1",
        extensionType: EXTENSION_TYPE.CHECKMARX,
      };

      const config2: ExtensionConfig = {
        extensionId: "ext-2",
        commandPrefix: "prefix-2",
        viewContainerPrefix: "view-2",
        displayName: "Extension 2",
        extensionType: EXTENSION_TYPE.DEVELOPER_ASSIST,
      };

      setExtensionConfig(config1);
      setExtensionConfig(config2);

      const retrieved = getExtensionConfig();
      expect(retrieved).to.deep.equal(config2);
    });
  });

  describe("getExtensionConfig error handling", () => {
    it("should throw error when configuration is not set", () => {
      expect(() => getExtensionConfig()).to.throw(
        "[ExtensionConfig] Extension configuration not set. Call setExtensionConfig() during activation."
      );
    });
  });

  describe("getCommandPrefix", () => {
    it("should return command prefix from configuration", () => {
      const config: ExtensionConfig = {
        extensionId: "test-id",
        commandPrefix: "my-commands",
        viewContainerPrefix: "my-view",
        displayName: "Test",
        extensionType: EXTENSION_TYPE.CHECKMARX,
      };

      setExtensionConfig(config);
      expect(getCommandPrefix()).to.equal("my-commands");
    });

    it("should throw error if config not set", () => {
      expect(() => getCommandPrefix()).to.throw();
    });
  });

  describe("getExtensionId", () => {
    it("should return extension ID from configuration", () => {
      const config: ExtensionConfig = {
        extensionId: "unique-id-123",
        commandPrefix: "prefix",
        viewContainerPrefix: "view",
        displayName: "Test",
        extensionType: EXTENSION_TYPE.CHECKMARX,
      };

      setExtensionConfig(config);
      expect(getExtensionId()).to.equal("unique-id-123");
    });

    it("should throw error if config not set", () => {
      expect(() => getExtensionId()).to.throw();
    });
  });

  describe("getExtensionType", () => {
    it("should return CHECKMARX extension type", () => {
      const config: ExtensionConfig = {
        extensionId: "test",
        commandPrefix: "prefix",
        viewContainerPrefix: "view",
        displayName: "Test",
        extensionType: EXTENSION_TYPE.CHECKMARX,
      };

      setExtensionConfig(config);
      expect(getExtensionType()).to.equal(EXTENSION_TYPE.CHECKMARX);
    });

    it("should return DEVELOPER_ASSIST extension type", () => {
      const config: ExtensionConfig = {
        extensionId: "test",
        commandPrefix: "prefix",
        viewContainerPrefix: "view",
        displayName: "Test",
        extensionType: EXTENSION_TYPE.DEVELOPER_ASSIST,
      };

      setExtensionConfig(config);
      expect(getExtensionType()).to.equal(EXTENSION_TYPE.DEVELOPER_ASSIST);
    });

    it("should throw error if config not set", () => {
      expect(() => getExtensionType()).to.throw();
    });
  });

  describe("isConfigured", () => {
    it("should return false when configuration is not set", () => {
      expect(isConfigured()).to.be.false;
    });

    it("should return true when configuration is set", () => {
      const config: ExtensionConfig = {
        extensionId: "test",
        commandPrefix: "prefix",
        viewContainerPrefix: "view",
        displayName: "Test",
        extensionType: EXTENSION_TYPE.CHECKMARX,
      };

      setExtensionConfig(config);
      expect(isConfigured()).to.be.true;
    });

    it("should return false after reset", () => {
      const config: ExtensionConfig = {
        extensionId: "test",
        commandPrefix: "prefix",
        viewContainerPrefix: "view",
        displayName: "Test",
        extensionType: EXTENSION_TYPE.CHECKMARX,
      };

      setExtensionConfig(config);
      expect(isConfigured()).to.be.true;

      resetExtensionConfig();
      expect(isConfigured()).to.be.false;
    });
  });

  describe("resetExtensionConfig", () => {
    it("should clear configuration", () => {
      const config: ExtensionConfig = {
        extensionId: "test",
        commandPrefix: "prefix",
        viewContainerPrefix: "view",
        displayName: "Test",
        extensionType: EXTENSION_TYPE.CHECKMARX,
      };

      setExtensionConfig(config);
      resetExtensionConfig();

      expect(() => getExtensionConfig()).to.throw();
    });

    it("should allow setting new configuration after reset", () => {
      const config1: ExtensionConfig = {
        extensionId: "id-1",
        commandPrefix: "prefix-1",
        viewContainerPrefix: "view-1",
        displayName: "Extension 1",
        extensionType: EXTENSION_TYPE.CHECKMARX,
      };

      const config2: ExtensionConfig = {
        extensionId: "id-2",
        commandPrefix: "prefix-2",
        viewContainerPrefix: "view-2",
        displayName: "Extension 2",
        extensionType: EXTENSION_TYPE.DEVELOPER_ASSIST,
      };

      setExtensionConfig(config1);
      resetExtensionConfig();
      setExtensionConfig(config2);

      expect(getExtensionConfig()).to.deep.equal(config2);
    });
  });

  describe("EXTENSION_TYPE constants", () => {
    it("should have CHECKMARX constant", () => {
      expect(EXTENSION_TYPE.CHECKMARX).to.equal("checkmarx");
    });

    it("should have DEVELOPER_ASSIST constant", () => {
      expect(EXTENSION_TYPE.DEVELOPER_ASSIST).to.equal("cx-dev-assist");
    });

    it("should have all keys defined", () => {
      expect(Object.keys(EXTENSION_TYPE)).to.include("CHECKMARX");
      expect(Object.keys(EXTENSION_TYPE)).to.include("DEVELOPER_ASSIST");
    });
  });

  describe("configuration object structure", () => {
    it("should accept checkmarx configuration", () => {
      const config: ExtensionConfig = {
        extensionId: "ast-results",
        commandPrefix: "ast-results",
        viewContainerPrefix: "ast",
        displayName: "Checkmarx",
        extensionType: EXTENSION_TYPE.CHECKMARX,
      };

      setExtensionConfig(config);
      const retrieved = getExtensionConfig();

      expect(retrieved.extensionId).to.equal("ast-results");
      expect(retrieved.commandPrefix).to.equal("ast-results");
      expect(retrieved.viewContainerPrefix).to.equal("ast");
      expect(retrieved.displayName).to.equal("Checkmarx");
      expect(retrieved.extensionType).to.equal(EXTENSION_TYPE.CHECKMARX);
    });

    it("should accept developer assist configuration", () => {
      const config: ExtensionConfig = {
        extensionId: "cx-dev-assist",
        commandPrefix: "cx-dev-assist",
        viewContainerPrefix: "cx-dev-assist",
        displayName: "CX Developer Assist",
        extensionType: EXTENSION_TYPE.DEVELOPER_ASSIST,
      };

      setExtensionConfig(config);
      const retrieved = getExtensionConfig();

      expect(retrieved.extensionId).to.equal("cx-dev-assist");
      expect(retrieved.extensionType).to.equal(EXTENSION_TYPE.DEVELOPER_ASSIST);
    });
  });
});
