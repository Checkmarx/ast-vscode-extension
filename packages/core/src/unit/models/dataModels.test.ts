import { expect } from "chai";
import { KicsFile } from "../../models/kicsFile";
import { KicsNode, KicsSummary } from "../../models/kicsNode";
import { KicsRealtime } from "../../models/kicsRealtime";
import { PackageData } from "../../models/packageData";
import { SastNode } from "../../models/sastNode";
import { ScaNode } from "../../models/scaNode";
import { SCSSecretDetectionNode } from "../../models/SCSSecretDetectionNode";

describe("Data model classes", () => {
  it("should construct KicsFile", () => {
    const file = new KicsFile("actual", "expected", [], "issue", 1, "fix", "type", "key", 2, "val", "sim");
    expect(file.actual_value).to.equal("actual");
    expect(file.line).to.equal(1);
  });

  it("should construct KicsNode and KicsSummary", () => {
    const node = new KicsNode("qid", "query", "group", "id", "high", "desc", {});
    expect(node.queryName).to.equal("query");
    const summary = new KicsSummary(1, 2, 3, 4);
    expect(summary.HIGH).to.equal(1);
  });

  it("should construct KicsRealtime", () => {
    const rt = new KicsRealtime("cat", "desc", [], "platform", "qid", "qname", "url", "high");
    expect(rt.query_name).to.equal("qname");
  });

  it("should construct PackageData", () => {
    const pkg = new PackageData("comment", "type", "url");
    expect(pkg.type).to.equal("type");
  });

  it("should construct SastNode", () => {
    const node = new SastNode(1, 2, "file.ts", "full", 3, 4, 5, "name", "dom", "method", 6, 7, "sys", "hash");
    expect(node.fileName).to.equal("file.ts");
  });

  it("should construct ScaNode", () => {
    const node = new ScaNode("desc", "id", [], []);
    expect(node.description).to.equal("desc");
  });

  it("should construct SCSSecretDetectionNode", () => {
    const node = new SCSSecretDetectionNode("id", "type", "status", "state", "high", "created", "desc", "rule", "file", 5, "ruleDesc", "fix");
    expect(node.ruleName).to.equal("rule");
  });
});
