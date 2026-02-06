/* eslint-disable @typescript-eslint/no-explicit-any */
import "./mocks/vscode-mock";
import * as vscode from "vscode";
import { expect } from "chai";
import * as sinon from "sinon";
import { Details } from "../utils/interface/details";
import { AstResult } from "../models/results";
import { constants } from "../utils/common/constants";
import { messages } from "../utils/common/messages";
import CxMask from "@checkmarx/ast-cli-javascript-wrapper/dist/main/mask/CxMask";
import * as extension from "../activate/activateCore"; // Import core activation module

describe("Details", () => {
  let details: Details;
  let mockContext: vscode.ExtensionContext;
  let mockResult: AstResult;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.parse("file:///mock"),
      extensionPath: "/mock",
      globalState: {
        get: sinon
          .stub()
          .returns([
            { name: "NOT_IGNORED" },
            { name: "IGNORED" },
            { name: "CUSTOM_STATE_1" },
            { name: "CUSTOM_STATE_2" },
          ]),
      },
    } as any;

    mockResult = {
      label: "Test_Result",
      type: "sast",
      severity: "HIGH",
      state: "NEW",
      description: "Test description",
      data: {
        value: "test value",
        remediation: "test remediation",
        ruleDescription: "test rule description",
      },
      getKicsValues: () => "test kics values",
      getTitle: () => "<h2>Test Title</h2>",
      getHtmlDetails: () => "<tr><td>Test Details</td></tr>",
      scaContent: () => "test sca content",
      scaNode: {
        packageIdentifier: "test-package",
      },
    } as any as AstResult;
    sandbox.stub(extension, "getGlobalContext").returns(mockContext);
    details = new Details(mockResult, mockContext, true);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("header", () => {
    it("should generate correct header HTML", () => {
      const severityPath = vscode.Uri.parse("file:///mock/severity.png");
      const html = details.header(severityPath);

      expect(html).to.include("Test Result"); // Checks if underscore is replaced
      expect(html).to.include(severityPath.toString());
      expect(html).to.include("header-container");
    });
  });

  describe("changes", () => {
    it("should generate changes section with triage", () => {
      const html = details.changes("test-class");

      expect(html).to.include("history-container-loader");
      expect(html).to.include("select_severity");
      expect(html).to.include("select_state");
    });
  });

  describe("triage", () => {
    it("should generate triage section for SAST", () => {
      const html = details.triage("test-class");

      expect(html).to.include("select_severity");
      expect(html).to.include("select_state");
      expect(html).to.include("Update");
      expect(html).to.include("comment_box");
    });

    it("should generate triage section for SCA without comment and update button", () => {
      mockResult.type = constants.sca;
      const html = details.triage("test-class");

      expect(html).to.not.include("select_severity");
      expect(html).to.include("select_state");
      expect(html).to.include("Update");
      expect(html).to.include("comment_box");
    });
  });

  describe("generalTab", () => {
    it("should generate general tab content", () => {
      const cxPath = vscode.Uri.parse("file:///mock/cx.png");
      const html = details.generalTab(cxPath);

      expect(html).to.include("Test description");
      expect(html).to.include("test kics values");
      expect(html).to.include("Test Title");
      expect(html).to.include("Test Details");
    });
  });

  describe("secretDetectiongeneralTab", () => {
    it("should generate secret detection general tab", () => {
      const html = details.secretDetectiongeneralTab();
      expect(html).to.include("Test description");
    });
  });

  describe("scaView", () => {
    it("should generate SCA view content", () => {
      const paths = {
        severityPath: vscode.Uri.parse("file:///mock/severity.png"),
        scaAtackVector: vscode.Uri.parse("file:///mock/attack.png"),
        scaComplexity: vscode.Uri.parse("file:///mock/complexity.png"),
        scaAuthentication: vscode.Uri.parse("file:///mock/auth.png"),
        scaConfidentiality: vscode.Uri.parse(
          "file:///mock/confidentiality.png"
        ),
        scaIntegrity: vscode.Uri.parse("file:///mock/integrity.png"),
        scaAvailability: vscode.Uri.parse("file:///mock/availability.png"),
        scaUpgrade: vscode.Uri.parse("file:///mock/upgrade.png"),
        scaUrl: vscode.Uri.parse("file:///mock/url.png"),
      };

      const html = details.scaView(
        paths.scaAtackVector,
        paths.scaComplexity,
        paths.scaAuthentication,
        paths.scaConfidentiality,
        paths.scaIntegrity,
        paths.scaAvailability,
        paths.scaUpgrade,
        paths.scaUrl
      );

      expect(html).to.include("test sca content");
    });
  });

  describe("secretDetectionDetailsRemediationTab", () => {
    it("should show remediation content when available", () => {
      const html = details.secretDetectionDetailsRemediationTab();
      expect(html).to.include("test remediation");
    });

    it("should show no remediation message when content unavailable", () => {
      mockResult.data.remediation = undefined;
      const html = details.secretDetectionDetailsRemediationTab();
      expect(html).to.include(messages.noRemediationExamplesTab);
    });
  });

  describe("secretDetectionDetailsDescriptionTab", () => {
    it("should show description content when available", () => {
      const html = details.secretDetectionDetailsDescriptionTab();
      expect(html).to.include("test rule description");
    });

    it("should show no description message when content unavailable", () => {
      mockResult.data.ruleDescription = undefined;
      const html = details.secretDetectionDetailsDescriptionTab();
      expect(html).to.include(messages.noDescriptionTab);
    });
  });

  describe("generateMaskedSection", () => {
    it("should generate HTML for masked secrets", () => {
      const masked: CxMask = {
        maskedSecrets: [
          {
            secret: "password123",
            masked: "********",
            line: 42,
          },
        ],
      } as CxMask;

      details.masked = masked;
      const html = details.generateMaskedSection();

      expect(html).to.include("password123");
      expect(html).to.include("********");
      expect(html).to.include("Line: 42");
    });

    it("should show no secrets message when no secrets are masked", () => {
      const html = details.generateMaskedSection();
      expect(html).to.include("No secrets were detected and masked");
    });
  });

  describe("tab", () => {
    it("should generate tabs structure with provided content", () => {
      const html = details.tab(
        "tab1 content",
        "tab2 content",
        "tab3 content",
        "Tab 1",
        "Tab 2",
        "Tab 3",
        "Tab 4",
        "tab4 content",
        "Tab 6",
        "tab6 content"
      );

      expect(html).to.include("tab1 content");
      expect(html).to.include("tab2 content");
      expect(html).to.include("tab3 content");
      expect(html).to.include("tab4 content");
      expect(html).to.include("tab6 content");
      expect(html).to.include("Tab 1");
      expect(html).to.include("Tab 2");
      expect(html).to.include("Tab 3");
      expect(html).to.include("Tab 4");
      expect(html).to.include("Tab 6");
    });

    it("should handle empty tab content and labels", () => {
      const html = details.tab("", "", "", "", "", "", "", "", "", "");
      expect(html.trim()).to.equal("");
    });
  });
});
