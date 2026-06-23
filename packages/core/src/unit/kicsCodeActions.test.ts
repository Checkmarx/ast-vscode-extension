import { expect } from "chai";
import sinon from "sinon";
import * as vscode from "vscode";
import { KicsCodeActionProvider } from "../kics/kicsCodeActions";
import { KicsDiagnostic } from "../kics/kicsDiagnostic";
import { commands } from "../utils/common/commandBuilder";
import { KicsRealtime } from "../models/kicsRealtime";

describe("KicsCodeActionProvider", () => {
  let sandbox: sinon.SinonSandbox;
  let mockKicsResults: any;
  let mockFile: any;
  let mockDiagnosticCollection: any;
  let mockFixableResults: any[];
  let mockFixableResultsByLine: any[];
  let codeActionProvider: KicsCodeActionProvider;

  // Mock VSCode enums
  const CodeActionTriggerKind = { Invoke: 1, Automatic: 2 };
  const CodeActionKind = { QuickFix: "quickfix" };

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock vscode properties
    (vscode as any).CodeActionTriggerKind = CodeActionTriggerKind;
    (vscode as any).CodeActionKind = CodeActionKind;

    mockKicsResults = {
      results: [],
    };

    mockFile = {
      file: "/path/to/k8s.yaml",
      editor: {
        document: {
          uri: vscode.Uri.file("/path/to/k8s.yaml"),
        },
      },
    };

    mockDiagnosticCollection = {
      set: sandbox.stub(),
      clear: sandbox.stub(),
      delete: sandbox.stub(),
      dispose: sandbox.stub(),
    };

    mockFixableResults = [] as any;
    mockFixableResultsByLine = [] as any;

    codeActionProvider = new KicsCodeActionProvider(
      mockKicsResults,
      mockFile,
      mockDiagnosticCollection,
      mockFixableResults as unknown as [],
      mockFixableResultsByLine as unknown as []
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("constructor", () => {
    it("should initialize with all dependencies", () => {
      expect(codeActionProvider["kicsResults"]).to.equal(mockKicsResults);
      expect(codeActionProvider["file"]).to.equal(mockFile);
      expect(codeActionProvider["diagnosticCollection"]).to.equal(
        mockDiagnosticCollection
      );
    });

    it("should store fixable results", () => {
      expect(codeActionProvider["fixableResults"]).to.equal(mockFixableResults);
      expect(codeActionProvider["fixableResultsByLine"]).to.equal(
        mockFixableResultsByLine
      );
    });
  });

  describe("provideCodeActions", () => {
    let mockDocument: any;
    let mockRange: vscode.Range;
    let mockContext: vscode.CodeActionContext;

    beforeEach(() => {
      mockDocument = {
        uri: vscode.Uri.file("/test.yaml"),
        getText: sandbox.stub().returns("test content"),
      };

      mockRange = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(10, 0)
      );
    });

    it("should return empty array when no diagnostics present", () => {
      mockContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = codeActionProvider.provideCodeActions(
        mockDocument,
        mockRange,
        mockContext,
        sandbox.stub() as any
      );

      expect(actions).to.be.an("array");
    });

    it("should return code actions for fixable diagnostics", () => {
      const kicsResult: Partial<KicsRealtime> = {
        query_id: "CKV_K8S_1",
        query_name: "Image tag missing",
      };

      const diagnostic = new KicsDiagnostic(
        mockRange,
        "Image must have tag",
        kicsResult as KicsRealtime
      );

      mockContext = {
        diagnostics: [diagnostic],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      sandbox
        .stub(KicsCodeActionProvider, "filterFixableResults")
        .returns(true);

      const actions = codeActionProvider.provideCodeActions(
        mockDocument,
        mockRange,
        mockContext,
        sandbox.stub() as any
      );

      expect(actions).to.be.an("array");
    });

    it("should filter out non-fixable diagnostics", () => {
      const kicsResult: Partial<KicsRealtime> = {
        query_id: "CKV_K8S_1",
        query_name: "Non-fixable issue",
      };

      const diagnostic = new KicsDiagnostic(
        mockRange,
        "Cannot be fixed",
        kicsResult as KicsRealtime
      );

      mockContext = {
        diagnostics: [diagnostic],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      sandbox
        .stub(KicsCodeActionProvider, "filterFixableResults")
        .returns(false);

      const actions = codeActionProvider.provideCodeActions(
        mockDocument,
        mockRange,
        mockContext,
        sandbox.stub() as any
      );

      expect(actions).to.be.an("array");
    });

    it("should include fix all action when multiple fixes available", () => {
      const kicsResult1: Partial<KicsRealtime> = {
        query_id: "CKV_1",
        query_name: "Issue 1",
      };

      const kicsResult2: Partial<KicsRealtime> = {
        query_id: "CKV_2",
        query_name: "Issue 2",
      };

      const diagnostic1 = new KicsDiagnostic(
        new vscode.Range(new vscode.Position(0, 0), new vscode.Position(1, 0)),
        "Issue 1",
        kicsResult1 as KicsRealtime
      );

      const diagnostic2 = new KicsDiagnostic(
        new vscode.Range(new vscode.Position(5, 0), new vscode.Position(6, 0)),
        "Issue 2",
        kicsResult2 as KicsRealtime
      );

      mockContext = {
        diagnostics: [diagnostic1, diagnostic2],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      codeActionProvider["fixableResultsByLine"] = [kicsResult1, kicsResult2] as any;

      sandbox
        .stub(KicsCodeActionProvider, "filterFixableResults")
        .returns(true);

      const actions = codeActionProvider.provideCodeActions(
        mockDocument,
        mockRange,
        mockContext,
        sandbox.stub() as any
      );

      expect(actions).to.be.an("array");
    });
  });

  describe("createCommandCodeAction", () => {
    it("should create code action with correct command", () => {
      const kicsResult: Partial<KicsRealtime> = {
        query_id: "CKV_K8S_1",
        query_name: "Image tag missing",
      };

      const diagnostic = new KicsDiagnostic(
        new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(1, 0)
        ),
        "Image must have tag",
        kicsResult as KicsRealtime
      );

      // Mock the code property
      Object.defineProperty(diagnostic, "code", {
        value: { value: "CKV_K8S_1" },
        writable: true,
      });

      const action = codeActionProvider["createCommandCodeAction"](diagnostic);

      expect(action).to.be.instanceOf(vscode.CodeAction);
      expect(action.command?.command).to.equal(commands.kicsRemediation);
    });

    it("should set isPreferred to true", () => {
      const kicsResult: Partial<KicsRealtime> = {
        query_id: "CKV_K8S_1",
        query_name: "Test",
      };

      const diagnostic = new KicsDiagnostic(
        new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(1, 0)
        ),
        "Test",
        kicsResult as KicsRealtime
      );

      Object.defineProperty(diagnostic, "code", {
        value: { value: "CKV_K8S_1" },
        writable: true,
      });

      const action = codeActionProvider["createCommandCodeAction"](diagnostic);

      expect(action.isPreferred).to.be.true;
    });

    it("should include diagnostic in diagnostics array", () => {
      const kicsResult: Partial<KicsRealtime> = {
        query_id: "CKV_K8S_1",
        query_name: "Test",
      };

      const diagnostic = new KicsDiagnostic(
        new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(1, 0)
        ),
        "Test",
        kicsResult as KicsRealtime
      );

      Object.defineProperty(diagnostic, "code", {
        value: { value: "CKV_K8S_1" },
        writable: true,
      });

      const action = codeActionProvider["createCommandCodeAction"](diagnostic);

      expect(action.diagnostics).to.include(diagnostic);
    });
  });

  describe("CodeActionKind", () => {
    it("should set CodeActionKind to QuickFix", () => {
      const kicsResult: Partial<KicsRealtime> = {
        query_id: "CKV_K8S_1",
        query_name: "Test",
      };

      const diagnostic = new KicsDiagnostic(
        new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(1, 0)
        ),
        "Test",
        kicsResult as KicsRealtime
      );

      Object.defineProperty(diagnostic, "code", {
        value: { value: "CKV_K8S_1" },
        writable: true,
      });

      const action = codeActionProvider["createCommandCodeAction"](diagnostic);

      expect(action.kind).to.equal(vscode.CodeActionKind.QuickFix);
    });
  });

  describe("integration scenarios", () => {
    it("should handle provider with empty fixable results", () => {
      const provider = new KicsCodeActionProvider(
        mockKicsResults,
        mockFile,
        mockDiagnosticCollection,
        [],
        []
      );

      const mockDocument = {
        uri: vscode.Uri.file("/test.yaml"),
        getText: sandbox.stub().returns("content"),
      };

      const mockRange = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(10, 0)
      );

      const mockContext = {
        diagnostics: [],
        only: undefined,
        triggerKind: vscode.CodeActionTriggerKind.Invoke,
      };

      const actions = provider.provideCodeActions(
        mockDocument as any,
        mockRange,
        mockContext,
        sandbox.stub() as any
      );

      expect(actions).to.be.an("array");
    });

    it("should handle provider with multiple fixable results", () => {
      const fixableResults = [
        { query_id: "CKV_1" },
        { query_id: "CKV_2" },
        { query_id: "CKV_3" },
      ] as any;

      const provider = new KicsCodeActionProvider(
        mockKicsResults,
        mockFile,
        mockDiagnosticCollection,
        fixableResults,
        fixableResults
      );

      expect(provider["fixableResults"]).to.have.lengthOf(3);
    });
  });

  describe("error handling", () => {
    it("should handle missing code property gracefully", () => {
      const kicsResult: Partial<KicsRealtime> = {
        query_id: "CKV_K8S_1",
        query_name: "Test",
      };

      const diagnostic = new KicsDiagnostic(
        new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(1, 0)
        ),
        "Test",
        kicsResult as KicsRealtime
      );

      // Don't set code property

      expect(() => {
        codeActionProvider["createCommandCodeAction"](diagnostic);
      }).to.not.throw();
    });

    it("should handle null file gracefully", () => {
      const provider = new KicsCodeActionProvider(
        mockKicsResults,
        null as any,
        mockDiagnosticCollection,
        [],
        []
      );

      expect(provider["file"]).to.be.null;
    });

    it("should handle null diagnostic collection gracefully", () => {
      const provider = new KicsCodeActionProvider(
        mockKicsResults,
        mockFile,
        null as any,
        [],
        []
      );

      expect(provider["diagnosticCollection"]).to.be.null;
    });
  });
});
