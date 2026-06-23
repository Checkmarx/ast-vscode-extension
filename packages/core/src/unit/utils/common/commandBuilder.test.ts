/* eslint-disable @typescript-eslint/no-explicit-any */
import "../../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import { commands } from "../../../utils/common/commandBuilder";
import { setExtensionConfig, resetExtensionConfig } from "../../../config/extensionConfig";

describe("CommandBuilder Tests", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setExtensionConfig({
      extensionId: "test-ext",
      commandPrefix: "test",
      viewContainerPrefix: "test",
      displayName: "Test Extension",
      extensionType: "checkmarx",
    });
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("Authentication Commands", () => {
    it("should build showAuth command with prefix", () => {
      const cmd = commands.showAuth;
      expect(cmd).to.equal("test.showAuth");
    });

    it("should build authentication command with prefix", () => {
      const cmd = commands.authentication;
      expect(cmd).to.equal("test.authentication");
    });

    it("should build resetAuthenticationCache command", () => {
      const cmd = commands.resetAuthenticationCache;
      expect(cmd).to.equal("test.resetAuthenticationCache");
    });
  });

  describe("Checkmarx One Assist Commands", () => {
    it("should build updateCxOneAssist command", () => {
      const cmd = commands.updateCxOneAssist;
      expect(cmd).to.equal("test.updateCxOneAssist");
    });

    it("should build astCxOneAssist view ID without prefix duplication", () => {
      const cmd = commands.astCxOneAssist;
      expect(cmd).to.include("test");
      expect(cmd).to.include("cxOneAssist");
    });

    it("should build astCxDevAssist view ID", () => {
      const cmd = commands.astCxDevAssist;
      expect(cmd).to.include("test");
      expect(cmd).to.include("cxDevAssist");
    });

    it("should build assistDocumentation command", () => {
      const cmd = commands.assistDocumentation;
      expect(cmd).to.equal("test.assistDocumentation");
    });
  });

  describe("Ignored View Commands", () => {
    it("should build openIgnoredView command", () => {
      const cmd = commands.openIgnoredView;
      expect(cmd).to.equal("test.openIgnoredView");
    });

    it("should build refreshIgnoredStatusBar command", () => {
      const cmd = commands.refreshIgnoredStatusBar;
      expect(cmd).to.equal("test.refreshIgnoredStatusBar");
    });
  });

  describe("AI Chat Commands", () => {
    it("should build fixWithAIChat command", () => {
      const cmd = commands.fixWithAIChat;
      expect(cmd).to.equal("test.fixWithAIChat");
    });

    it("should build viewDetails command", () => {
      const cmd = commands.viewDetails;
      expect(cmd).to.equal("test.viewDetails");
    });

    it("should build openAIChat command", () => {
      const cmd = commands.openAIChat;
      expect(cmd).to.equal("test.openAIChat");
    });

    it("should build ignorePackage command", () => {
      const cmd = commands.ignorePackage;
      expect(cmd).to.equal("test.ignorePackage");
    });

    it("should build ignoreAll command", () => {
      const cmd = commands.ignoreAll;
      expect(cmd).to.equal("test.ignoreAll");
    });
  });

  describe("MCP Commands", () => {
    it("should build installMCP command", () => {
      const cmd = commands.installMCP;
      expect(cmd).to.equal("test.installMCP");
    });
  });

  describe("Settings Commands", () => {
    it("should build viewSettings command", () => {
      const cmd = commands.viewSettings;
      expect(cmd).to.equal("test.viewSettings");
    });

    it("should build setings command (alias for viewSettings)", () => {
      const cmd = commands.setings;
      expect(cmd).to.equal("test.viewSettings");
    });

    it("should return workbench openSettings command", () => {
      const cmd = commands.openSettings;
      expect(cmd).to.equal("workbench.action.openSettings");
    });

    it("should build openSettingsArgs with extension scope", () => {
      const args = commands.openSettingsArgs;
      expect(args).to.include("@ext:checkmarx.test");
    });

    it("should build openSettingsArgsAiAssistant", () => {
      const args = commands.openSettingsArgsAiAssistant;
      expect(args).to.include("@ext:checkmarx.test");
      expect(args).to.include("AI Assistant");
    });
  });

  describe("Error Commands", () => {
    it("should build showError command", () => {
      const cmd = commands.showError;
      expect(cmd).to.equal("test.showError");
    });
  });

  describe("KICS Commands", () => {
    it("should build clearKicsDiagnostics command", () => {
      const cmd = commands.clearKicsDiagnostics;
      expect(cmd).to.equal("test.clearKicsDiagnostics");
    });

    it("should build kicsRealtime command", () => {
      const cmd = commands.kicsRealtime;
      expect(cmd).to.equal("test.kicsRealtime");
    });

    it("should build kicsRemediation command", () => {
      const cmd = commands.kicsRemediation;
      expect(cmd).to.equal("test.kicsRemediation");
    });

    it("should build kicsSetings command", () => {
      const cmd = commands.kicsSetings;
      expect(cmd).to.equal("test.kicsSetings");
    });
  });

  describe("Realtime Scanner Commands", () => {
    it("should build clearRealtimeScanners command", () => {
      const cmd = commands.clearRealtimeScanners;
      expect(cmd).to.equal("test.clearRealtimeScanners");
    });
  });

  describe("Scan Commands", () => {
    it("should build createScan command", () => {
      const cmd = commands.createScan;
      expect(cmd).to.equal("test.createScan");
    });

    it("should build createSCAScan command", () => {
      const cmd = commands.createSCAScan;
      expect(cmd).to.equal("test.createSCAScan");
    });

    it("should build cancelScan command", () => {
      const cmd = commands.cancelScan;
      expect(cmd).to.equal("test.cancelScan");
    });

    it("should build pollScan command", () => {
      const cmd = commands.pollScan;
      expect(cmd).to.equal("test.pollScan");
    });
  });

  describe("Tree Commands", () => {
    it("should build refreshTree command", () => {
      const cmd = commands.refreshTree;
      expect(cmd).to.equal("test.refreshTree");
    });

    it("should build clearTree command", () => {
      const cmd = commands.clearTree;
      expect(cmd).to.equal("test.clearTree");
    });

    it("should build refreshScaTree command", () => {
      const cmd = commands.refreshScaTree;
      expect(cmd).to.equal("test.refreshScaTree");
    });

    it("should build clearScaTree command", () => {
      const cmd = commands.clearScaTree;
      expect(cmd).to.equal("test.clearScaTree");
    });

    it("should build refreshDastTree command", () => {
      const cmd = commands.refreshDastTree;
      expect(cmd).to.equal("test.refreshDastTree");
    });

    it("should build clearDastTree command", () => {
      const cmd = commands.clearDastTree;
      expect(cmd).to.equal("test.clearDastTree");
    });

    it("should build clear command", () => {
      const cmd = commands.clear;
      expect(cmd).to.equal("test.clear");
    });

    it("should build clearSca command", () => {
      const cmd = commands.clearSca;
      expect(cmd).to.equal("test.clearSca");
    });
  });

  describe("Details Commands", () => {
    it("should build newDetails command", () => {
      const cmd = commands.newDetails;
      expect(cmd).to.equal("test.newDetails");
    });

    it("should build gpt command", () => {
      const cmd = commands.gpt;
      expect(cmd).to.equal("test.gpt");
    });

    it("should build openDetailsFromDiagnostic command", () => {
      const cmd = commands.openDetailsFromDiagnostic;
      expect(cmd).to.equal("test.openDetailsFromDiagnostic");
    });
  });

  describe("Filter Commands", () => {
    it("should build filterBySeverity command", () => {
      expect(commands.filterBySeverity).to.equal("test.filterBySeverity");
    });

    it("should build filterByState command", () => {
      expect(commands.filterByState).to.equal("test.filterByState");
    });

    it("should build all Critical filter variants", () => {
      expect(commands.filterCriticalToggle).to.equal("test.filterCriticalToggle");
      expect(commands.filterCriticalUntoggle).to.equal("test.filterCriticalUntoggle");
      expect(commands.filterCritical).to.equal("test.filterCritical");
    });

    it("should build all High filter variants", () => {
      expect(commands.filterHighToggle).to.equal("test.filterHighToggle");
      expect(commands.filterHighUntoggle).to.equal("test.filterHighUntoggle");
      expect(commands.filterHigh).to.equal("test.filterHigh");
    });

    it("should build all state filters", () => {
      expect(commands.filterConfirmed).to.equal("test.filterConfirmed");
      expect(commands.filterToVerify).to.equal("test.filterToVerify");
      expect(commands.filterUrgent).to.equal("test.filterUrgent");
      expect(commands.filterNotIgnored).to.equal("test.filterNotIgnored");
      expect(commands.filterIgnored).to.equal("test.filterIgnored");
    });
  });

  describe("Group By Commands", () => {
    it("should build groupBy command", () => {
      expect(commands.groupBy).to.equal("test.groupBy");
    });

    it("should build all groupByFile variants", () => {
      expect(commands.groupByFile).to.equal("test.groupByFile");
      expect(commands.groupByFileActive).to.equal("test.groupByFileActive");
      expect(commands.groupByFileCommand).to.equal("test.groupByFileCommand");
    });

    it("should build all groupByLanguage variants", () => {
      expect(commands.groupByLanguage).to.equal("test.groupByLanguage");
      expect(commands.groupByLanguageActive).to.equal("test.groupByLanguageActive");
      expect(commands.groupByLanguageCommand).to.equal("test.groupByLanguageCommand");
    });

    it("should build all groupBySeverity variants", () => {
      expect(commands.groupBySeverity).to.equal("test.groupBySeverity");
      expect(commands.groupBySeverityActive).to.equal("test.groupBySeverityActive");
      expect(commands.groupBySeverityCommand).to.equal("test.groupBySeverityCommand");
    });
  });

  describe("Picker Commands", () => {
    it("should build showPicker command", () => {
      expect(commands.showPicker).to.equal("test.showPicker");
    });

    it("should build all picker variants", () => {
      expect(commands.generalPick).to.equal("test.generalPick");
      expect(commands.projectPick).to.equal("test.projectPick");
      expect(commands.branchPick).to.equal("test.branchPick");
      expect(commands.scanPick).to.equal("test.scanPick");
      expect(commands.scanInput).to.equal("test.scanInput");
    });
  });

  describe("View Commands", () => {
    it("should return docAndFeedback view ID without prefix", () => {
      expect(commands.docAndFeedback).to.equal("docAndFeedback");
    });

    it("should build dastResults command", () => {
      expect(commands.dastResults).to.equal("test.dastResults");
    });

    it("should return astResultsPromo view ID without prefix", () => {
      expect(commands.astResultsPromo).to.equal("astResultsPromo");
    });

    it("should return scaAutoScanPromo view ID without prefix", () => {
      expect(commands.scaAutoScanPromo).to.equal("scaAutoScanPromo");
    });
  });

  describe("Status Bar Commands", () => {
    it("should build refreshKicsStatusBar command", () => {
      expect(commands.refreshKicsStatusBar).to.equal("test.refreshKicsStatusBar");
    });

    it("should build refreshScaStatusBar command", () => {
      expect(commands.refreshScaStatusBar).to.equal("test.refreshScaStatusBar");
    });

    it("should build refreshRiskManagementView command", () => {
      expect(commands.refreshRiskManagementView).to.equal("test.refreshRiskManagementView");
    });
  });

  describe("Context Commands", () => {
    it("should return setContext as VSCode built-in command", () => {
      expect(commands.setContext).to.equal("setContext");
    });

    it("should build isDastEnabled command", () => {
      expect(commands.isDastEnabled).to.equal("test.isDastEnabled");
    });

    it("should build isValidCredentials command", () => {
      expect(commands.isValidCredentials).to.equal("test.isValidCredentials");
    });

    it("should build isCxOneAssistEnabled command", () => {
      expect(commands.isCxOneAssistEnabled).to.equal("test.isCxOneAssistEnabled");
    });

    it("should build isCxDevAssistEnabled command", () => {
      expect(commands.isCxDevAssistEnabled).to.equal("test.isCxDevAssistEnabled");
    });

    it("should build isStandaloneEnabled command", () => {
      expect(commands.isStandaloneEnabled).to.equal("test.isStandaloneEnabled");
    });

    it("should build isScanEnabled command", () => {
      expect(commands.isScanEnabled).to.equal("test.isScanEnabled");
    });

    it("should build isScaScanEnabled command", () => {
      expect(commands.isScaScanEnabled).to.equal("test.isScaScanEnabled");
    });
  });

  describe("Development Commands", () => {
    it("should build mockTokenTest command", () => {
      expect(commands.mockTokenTest).to.equal("test.mockTokenTest");
    });
  });
});
