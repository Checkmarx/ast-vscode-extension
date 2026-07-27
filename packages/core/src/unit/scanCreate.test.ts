import { expect } from "chai";
import "./mocks/vscode-mock";
import "./mocks/cxWrapper-mock";
import * as vscode from "vscode";
import { initialize, getCx } from "../cx";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";

describe("Cx - scanCreate", () => {
  beforeEach(() => {
    // Set up extension configuration before tests run
    setExtensionConfig({
      extensionId: 'ast-results',
      commandPrefix: 'ast-results',
      viewContainerPrefix: 'ast',
      displayName: 'Checkmarx',
      extensionType: 'checkmarx',
    });

    // Initialize Cx with mock context
    const mockContext = {
      subscriptions: [],
      extensionUri: vscode.Uri.parse("file:///test"),
      extensionPath: "/test",
      secrets: {
        get: () => Promise.resolve("valid-api-key"),
        store: () => Promise.resolve(),
        delete: () => Promise.resolve()
      }
    } as any;
    initialize(mockContext);
  });

  afterEach(() => {
    resetExtensionConfig();
  });

  it("should create scan when all parameters are provided", async () => {
    const projectName = "test-project";
    const branchName = "main";
    const sourcePath = "/test/path";
    const cx = getCx();

    const result = await cx.scanCreate(projectName, branchName, sourcePath);

    expect(result).to.deep.equal({
      id: "scan-123",
      status: "Created",
      projectId: "test-project-id",
      branch: "main",
      createdAt: "2023-04-19T10:07:37.628413+01:00"
    });
  });

  it("should return undefined when projectName is not provided", async () => {
    const cx = getCx();
    const result = await cx.scanCreate(undefined, "main", "/test/path");
    expect(result).to.be.undefined;
  });

  it("should return undefined when branchName is not provided", async () => {
    const cx = getCx();
    const result = await cx.scanCreate("test-project", undefined, "/test/path");
    expect(result).to.be.undefined;
  });
});