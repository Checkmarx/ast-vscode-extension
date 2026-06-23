import { expect } from "chai";
import sinon from "sinon";
import * as vscode from "vscode";
import { IgnoreCommand } from "../commands/ignoreOssCommand";
import { IgnoreFileManager } from "../realtimeScanners/common/ignoreFileManager";

describe("IgnoreCommand", () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let ignoreCommand: IgnoreCommand;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockContext = {
      subscriptions: [],
    };

    sandbox.stub(vscode.commands, "registerCommand");
    sandbox.stub(vscode.window, "showErrorMessage");
    sandbox.stub(vscode.window, "showInformationMessage");
    sandbox.stub(vscode.workspace, "workspaceFolders").value([
      { uri: vscode.Uri.file("/workspace") },
    ]);

    sandbox
      .stub(vscode.window, "activeTextEditor")
      .value({
        document: {
          uri: vscode.Uri.file("/workspace/package.json"),
        },
      });

    sandbox.stub(IgnoreFileManager, "getInstance").returns({
      initialize: sandbox.stub(),
      addIgnoredEntry: sandbox.stub(),
    } as any as IgnoreFileManager);

    ignoreCommand = new IgnoreCommand(mockContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("constructor", () => {
    it("should register command on instantiation", () => {
      expect(mockContext.subscriptions.length).to.be.greaterThan(0);
    });

    it("should register cx.ignore command", () => {
      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      expect(registerStub.calledWith("cx.ignore", sinon.match.func)).to.be
        .true;
    });
  });

  describe("ignore command handler", () => {
    let commandHandler: Function;

    beforeEach(() => {
      const registerStub = vscode.commands.registerCommand as sinon.SinonStub;
      const call = registerStub.getCall(0);
      commandHandler = call.args[1];
    });

    it("should show error when workspace is missing", async () => {
      (vscode.workspace as any).workspaceFolders = undefined;

      await commandHandler({
        packageManager: "npm",
        packageName: "lodash",
        version: "4.17.20",
      });

      expect(
        (vscode.window.showErrorMessage as sinon.SinonStub).calledWith(
          "Missing context or workspace"
        )
      ).to.be.true;
    });

    it("should show error when editor is not active", async () => {
      (vscode.window as any).activeTextEditor = undefined;

      await commandHandler({
        packageManager: "npm",
        packageName: "lodash",
        version: "4.17.20",
      });

      expect(
        (vscode.window.showErrorMessage as sinon.SinonStub).calledWith(
          "Missing context or workspace"
        )
      ).to.be.true;
    });

    it("should show error when hover data is missing", async () => {
      await commandHandler(undefined);

      expect(
        (vscode.window.showErrorMessage as sinon.SinonStub).calledWith(
          "Missing context or workspace"
        )
      ).to.be.true;
    });

    it("should initialize IgnoreFileManager with workspace folder", async () => {
      const hoverData = {
        packageManager: "npm",
        packageName: "lodash",
        version: "4.17.20",
      };

      await commandHandler(hoverData);

      const ignoreManager = IgnoreFileManager.getInstance() as any;
      expect(ignoreManager.initialize.calledOnce).to.be.true;
    });

    it("should add ignored entry to IgnoreFileManager", async () => {
      const hoverData = {
        packageManager: "npm",
        packageName: "lodash",
        version: "4.17.20",
      };

      await commandHandler(hoverData);

      const ignoreManager = IgnoreFileManager.getInstance() as any;
      expect(ignoreManager.addIgnoredEntry.calledOnce).to.be.true;

      const addedEntry = ignoreManager.addIgnoredEntry.getCall(0).args[0];
      expect(addedEntry.packageManager).to.equal("npm");
      expect(addedEntry.packageName).to.equal("lodash");
      expect(addedEntry.packageVersion).to.equal("4.17.20");
      expect(addedEntry.filePath).to.include("package.json");
    });

    it("should include dateAdded in ignored entry", async () => {
      const hoverData = {
        packageManager: "npm",
        packageName: "express",
        version: "4.18.0",
      };

      await commandHandler(hoverData);

      const ignoreManager = IgnoreFileManager.getInstance() as any;
      const addedEntry = ignoreManager.addIgnoredEntry.getCall(0).args[0];

      expect(addedEntry.dateAdded).to.exist;
      expect(addedEntry.dateAdded).to.be.a("string");
      // Verify it's a valid ISO string
      expect(new Date(addedEntry.dateAdded).toISOString()).to.equal(
        addedEntry.dateAdded
      );
    });

    it("should show success message after ignoring package", async () => {
      const hoverData = {
        packageManager: "npm",
        packageName: "lodash",
        version: "4.17.20",
      };

      await commandHandler(hoverData);

      expect(
        (vscode.window.showInformationMessage as sinon.SinonStub).calledWith(
          "lodash@4.17.20 ignored."
        )
      ).to.be.true;
    });

    it("should handle multiple package ignores", async () => {
      const ignoreManager = IgnoreFileManager.getInstance() as any;

      const packages = [
        {
          packageManager: "npm",
          packageName: "package1",
          version: "1.0.0",
        },
        {
          packageManager: "npm",
          packageName: "package2",
          version: "2.0.0",
        },
      ];

      for (const pkg of packages) {
        await commandHandler(pkg);
      }

      expect(ignoreManager.addIgnoredEntry.callCount).to.equal(2);
    });

    it("should use active editor's file path", async () => {
      const testFilePath = "/workspace/src/utils.ts";
      (vscode.window as any).activeTextEditor = {
        document: {
          uri: vscode.Uri.file(testFilePath),
        },
      };

      const hoverData = {
        packageManager: "npm",
        packageName: "lodash",
        version: "4.17.20",
      };

      await commandHandler(hoverData);

      const ignoreManager = IgnoreFileManager.getInstance() as any;
      const addedEntry = ignoreManager.addIgnoredEntry.getCall(0).args[0];

      expect(addedEntry.filePath).to.equal(testFilePath);
    });

    it("should handle yarn package manager", async () => {
      const hoverData = {
        packageManager: "yarn",
        packageName: "react",
        version: "18.0.0",
      };

      await commandHandler(hoverData);

      const ignoreManager = IgnoreFileManager.getInstance() as any;
      const addedEntry = ignoreManager.addIgnoredEntry.getCall(0).args[0];

      expect(addedEntry.packageManager).to.equal("yarn");
    });

    it("should handle pnpm package manager", async () => {
      const hoverData = {
        packageManager: "pnpm",
        packageName: "typescript",
        version: "5.0.0",
      };

      await commandHandler(hoverData);

      const ignoreManager = IgnoreFileManager.getInstance() as any;
      const addedEntry = ignoreManager.addIgnoredEntry.getCall(0).args[0];

      expect(addedEntry.packageManager).to.equal("pnpm");
    });
  });
});
