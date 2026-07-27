/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import { CxCodeActionProvider } from "../../realtimeScanners/scanners/CxCodeActionProvider";
import {
  setExtensionConfig,
  resetExtensionConfig,
} from "../../config/extensionConfig";

describe("CxCodeActionProvider", () => {
  let sandbox: sinon.SinonSandbox;
  let provider: CxCodeActionProvider;

  const makeDiagnostic = (data: any) =>
    ({
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
      message: "m",
      data,
    } as any);

  const callProvide = (diagnostics: any[]) =>
    provider.provideCodeActions(
      {} as any,
      {} as any,
      { diagnostics } as any,
      {} as any
    );

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    });
    provider = new CxCodeActionProvider();
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  it("should return undefined when there are no diagnostics", () => {
    expect(callProvide([])).to.be.undefined;
  });

  it("should skip diagnostics without cx data", () => {
    expect(callProvide([makeDiagnostic(undefined)])).to.be.undefined;
    expect(callProvide([makeDiagnostic({ item: null, cxType: "oss" })])).to.be
      .undefined;
    expect(callProvide([makeDiagnostic({ item: {}, cxType: undefined })])).to.be
      .undefined;
  });

  it("should produce fix, view details and ignore actions for a generic item", () => {
    const data = { item: { title: "x" }, cxType: "iac" };
    const actions = callProvide([makeDiagnostic(data)]);
    expect(actions).to.exist;
    expect(actions!.length).to.equal(3);
    const titles = actions!.map((a) => a.title);
    expect(titles[0]).to.include("Fix with");
    expect(titles).to.include("View details");
    expect(titles).to.include("Ignore this vulnerability");
  });

  it("should add an 'Ignore all of this type' action for OSS packages (packageManager)", () => {
    const data = {
      item: { packageManager: "npm", packageName: "lodash" },
      cxType: "oss",
    };
    const actions = callProvide([makeDiagnostic(data)]);
    expect(actions!.length).to.equal(4);
    expect(actions!.map((a) => a.title)).to.include("Ignore all of this type");
  });

  it("should add an 'Ignore all of this type' action for container images (imageName)", () => {
    const data = { item: { imageName: "nginx", imageTag: "latest" }, cxType: "containers" };
    const actions = callProvide([makeDiagnostic(data)]);
    expect(actions!.length).to.equal(4);
  });

  it("should use 'Ignore this secret in file' label for secret items", () => {
    const data = {
      item: { title: "AWS key", secretValue: "abc123" },
      cxType: "secrets",
    };
    const actions = callProvide([makeDiagnostic(data)]);
    const titles = actions!.map((a) => a.title);
    expect(titles).to.include("Ignore this secret in file");
  });

  it("should accumulate actions across multiple diagnostics", () => {
    const a = makeDiagnostic({ item: { title: "x" }, cxType: "iac" });
    const b = makeDiagnostic({ item: { packageManager: "npm" }, cxType: "oss" });
    const actions = callProvide([a, b]);
    // 3 from the generic item + 4 from the package item
    expect(actions!.length).to.equal(7);
  });

  it("should attach commands with the item as the argument", () => {
    const item = { title: "x" };
    const actions = callProvide([makeDiagnostic({ item, cxType: "iac" })]);
    actions!.forEach((action) => {
      expect(action.command).to.exist;
      expect((action.command as any).arguments[0]).to.equal(item);
    });
  });
});
