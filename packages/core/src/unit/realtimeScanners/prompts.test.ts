import "../mocks/vscode-mock";
import { expect } from "chai";
import { setExtensionConfig, resetExtensionConfig, EXTENSION_TYPE, ExtensionType } from "../../config/extensionConfig";
import {
  SCA_REMEDIATION_PROMPT,
  SCA_EXPLANATION_PROMPT,
  SECRET_REMEDIATION_PROMPT,
  ASCA_REMEDIATION_PROMPT,
  CONTAINERS_REMEDIATION_PROMPT,
  IAC_REMEDIATION_PROMPT,
} from "../../realtimeScanners/scanners/prompts";

describe("Remediation prompts MCP server name", () => {
  const prompts: Record<string, () => string> = {
    SCA: () => SCA_REMEDIATION_PROMPT("lodash", "4.17.0", "npm", "High"),
    Secrets: () => SECRET_REMEDIATION_PROMPT("AWS key", "Hardcoded key", "High"),
    ASCA: () => ASCA_REMEDIATION_PROMPT("Unsafe OS Command generation", "desc", "High", "advice", 3),
    Containers: () => CONTAINERS_REMEDIATION_PROMPT("dockerfile", "nginx", "1.0", "High"),
    IaC: () => IAC_REMEDIATION_PROMPT("Open port", "desc", "High", "tf", "closed", "open", 3),
  };

  function configure(extensionType: ExtensionType) {
    setExtensionConfig({
      extensionId: "test",
      commandPrefix: "test",
      viewContainerPrefix: "test",
      displayName: "Test",
      extensionType,
    });
  }

  afterEach(() => {
    resetExtensionConfig();
  });

  for (const [name, build] of Object.entries(prompts)) {
    it(`${name}: names the "Checkmarx One Assist" MCP server for Checkmarx One`, () => {
      configure(EXTENSION_TYPE.CHECKMARX);
      const prompt = build();
      expect(prompt).to.include("Checkmarx One Assist MCP");
      // The bare "Checkmarx" server belongs to the cx-devassist plugin
      expect(prompt).to.not.match(/\bCheckmarx MCP\b/);
      expect(prompt).to.not.match(/Checkmarx (code|package|image)Remediation tool/);
    });

    it(`${name}: names the "Checkmarx Developer Assist" MCP server for Developer Assist`, () => {
      configure(EXTENSION_TYPE.DEVELOPER_ASSIST);
      expect(build()).to.include("Checkmarx Developer Assist MCP");
    });
  }

  it("keeps the brand name (not the server name) in attribution text", () => {
    configure(EXTENSION_TYPE.CHECKMARX);
    const explanation = SCA_EXPLANATION_PROMPT("pkg", "1.0", "Malicious", []);
    expect(explanation).to.include("Checkmarx Security researchers");
  });
});
