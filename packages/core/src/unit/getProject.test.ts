import { expect } from "chai";
import "./mocks/vscode-mock";
import "./mocks/cxWrapper-mock";
import * as vscode from "vscode";
import { initialize, getCx } from "../cx";
import { setExtensionConfig, resetExtensionConfig } from "../config/extensionConfig";

describe("Cx - getProject", () => {
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

  it("should return project object when projectId is provided", async () => {
    const projectId = "test-project-id";
    const cx = getCx();
    const result = await cx.getProject(projectId);

    expect(result).to.deep.equal({
      id: "test-project-id",
      name: "Test Project",
      createdAt: "2023-04-19T10:07:37.628413+01:00",
      updatedAt: "2023-04-19T09:08:27.151913Z",
      groups: [],
      tags: {},
      criticality: 3
    });
  });

  it("should return undefined when projectId is not provided", async () => {
    const cx = getCx();
    const result = await cx.getProject(undefined);
    expect(result).to.be.undefined;
  });
});