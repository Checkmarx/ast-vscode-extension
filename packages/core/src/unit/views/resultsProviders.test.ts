/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import { ResultsProvider } from "../../views/resultsProviders";
import { TreeItem } from "../../utils/tree/treeItem";
import { constants } from "../../utils/common/constants";

describe("ResultsProvider", () => {
  let provider: ResultsProvider;
  let sandbox: sinon.SinonSandbox;
  let statusBarItem: any;
  let context: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    statusBarItem = {
      text: "",
      tooltip: undefined,
      command: undefined,
      show: sandbox.stub(),
      hide: sandbox.stub(),
    };
    context = { subscriptions: [], globalState: { get: sandbox.stub(), update: sandbox.stub() } };
    provider = new ResultsProvider(context, statusBarItem);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("getTreeItem", () => {
    it("should return the element passed to it", () => {
      const item = new TreeItem("label", undefined, undefined);
      expect(provider.getTreeItem(item)).to.equal(item);
    });
  });

  describe("getChildren", () => {
    it("should return undefined data when no element and no data", () => {
      expect(provider.getChildren(undefined)).to.be.undefined;
    });

    it("should return element children when an element is given", () => {
      const child = new TreeItem("child", undefined, undefined);
      const parent = new TreeItem("parent", undefined, undefined, [child]);
      const result = provider.getChildren(parent);
      expect(result).to.deep.equal([child]);
    });
  });

  describe("getParent", () => {
    it("should return undefined when there is no data", () => {
      const item = new TreeItem("x", undefined, undefined);
      expect(provider.getParent(item)).to.be.undefined;
    });

    it("should find the parent of a nested item", () => {
      const child = new TreeItem("child", undefined, undefined);
      const parent = new TreeItem("parent", undefined, undefined, [child]);
      (provider as any).data = [parent];

      expect(provider.getParent(child)).to.equal(parent);
    });

    it("should return undefined for a top-level item", () => {
      const top = new TreeItem("top", undefined, undefined);
      (provider as any).data = [top];

      expect(provider.getParent(top)).to.be.undefined;
    });
  });

  describe("determineTypeLabel", () => {
    it("should return the label when present", () => {
      const result = { label: "MyLabel" } as any;
      expect(provider.determineTypeLabel(result)).to.equal("MyLabel");
    });

    it("should return secret detection label for SCS secret detection type", () => {
      const result = { type: constants.scsSecretDetection } as any;
      expect(provider.determineTypeLabel(result)).to.equal(constants.secretDetection);
    });

    it("should return undefined for an unrecognized type", () => {
      const result = { type: "unknown" } as any;
      expect(provider.determineTypeLabel(result)).to.be.undefined;
    });
  });

  describe("createSummaryItem", () => {
    it("should build a summary counting severities", () => {
      const list = [
        { label: "A", severity: "HIGH", type: constants.scsSecretDetection },
        { label: "B", severity: "HIGH", type: constants.scsSecretDetection },
        { label: "C", severity: "LOW", type: constants.scsSecretDetection },
      ] as any[];

      const item = createSummaryLabel(provider, list);
      expect(item).to.include("HIGH: 2");
      expect(item).to.include("LOW: 1");
    });

    it("should produce an empty label when nothing matches", () => {
      const list = [{ severity: "HIGH", type: "unknown" }] as any[];
      const item = createSummaryLabel(provider, list);
      expect(item).to.equal("");
    });
  });

  describe("refresh", () => {
    it("should fire the tree data change event", () => {
      expect(() => provider.refresh()).to.not.throw();
    });
  });

  describe("status bar helpers", () => {
    it("hideStatusBarItem should reset and hide the status bar", () => {
      (provider as any).hideStatusBarItem();
      expect(statusBarItem.text).to.equal(constants.extensionName);
      expect(statusBarItem.hide.called).to.be.true;
    });

    it("showStatusBarItem should set message and show the status bar", () => {
      (provider as any).showStatusBarItem("Working...");
      expect(statusBarItem.text).to.equal(constants.refreshingTree);
      expect(statusBarItem.tooltip).to.equal("Working...");
      expect(statusBarItem.show.called).to.be.true;
    });
  });

  describe("calculateEditorPosition (private)", () => {
    it("should convert 1-based line/column to 0-based", () => {
      const pos = (provider as any).calculateEditorPosition(5, 3);
      expect(pos.line).to.equal(4);
      expect(pos.character).to.equal(2);
    });

    it("should clamp non-positive line/column to 0", () => {
      const pos = (provider as any).calculateEditorPosition(0, 0);
      expect(pos.line).to.equal(0);
      expect(pos.character).to.equal(0);
    });
  });

  describe("findMatchingSastNode (private)", () => {
    it("should match by uniqueId", () => {
      const nodes = [{ uniqueId: "u1", fileName: "a", line: 1 }, { uniqueId: "u2", fileName: "b", line: 2 }];
      const match = (provider as any).findMatchingSastNode(nodes, { uniqueId: "u2" });
      expect(match.uniqueId).to.equal("u2");
    });

    it("should match by fileName and line when no uniqueId", () => {
      const nodes = [{ uniqueId: "u1", fileName: "a.js", line: 10 }];
      const match = (provider as any).findMatchingSastNode(nodes, { fileName: "a.js", line: 10 });
      expect(match).to.exist;
    });

    it("should return undefined when nothing matches", () => {
      const nodes = [{ uniqueId: "u1", fileName: "a.js", line: 10 }];
      const match = (provider as any).findMatchingSastNode(nodes, { uniqueId: "zzz" });
      expect(match).to.be.undefined;
    });

    it("should return undefined when no criteria supplied", () => {
      const nodes = [{ uniqueId: "u1", fileName: "a.js", line: 10 }];
      const match = (provider as any).findMatchingSastNode(nodes, {});
      expect(match).to.be.undefined;
    });
  });

  describe("checkNodeForMatch (private)", () => {
    it("should return undefined when node has no result", () => {
      const node = new TreeItem("x", undefined, undefined);
      expect((provider as any).checkNodeForMatch(node, { uniqueId: "u1" })).to.be.undefined;
    });

    it("should return undefined when result has no sast nodes", () => {
      const node = new TreeItem("x", undefined, { sastNodes: [], getTreeIcon: () => ({}) } as any);
      expect((provider as any).checkNodeForMatch(node, { uniqueId: "u1" })).to.be.undefined;
    });

    it("should return node and result when a sast node matches", () => {
      const res = {
        sastNodes: [{ uniqueId: "u1", fileName: "a", line: 1 }],
        getTreeIcon: () => ({}),
      } as any;
      const node = new TreeItem("x", undefined, res);
      const result = (provider as any).checkNodeForMatch(node, { uniqueId: "u1" });
      expect(result).to.exist;
      expect(result.node).to.equal(node);
    });
  });
});

// Helper to read the generated summary item label
function createSummaryLabel(provider: ResultsProvider, list: any[]): string {
  const item = provider.createSummaryItem(list);
  return item.label as string;
}
