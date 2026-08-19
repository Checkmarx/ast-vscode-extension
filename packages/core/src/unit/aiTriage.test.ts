import "./mocks/vscode-mock";
import { expect } from "chai";
import {
  AiTriagePhase,
  isAiTriageSupported,
  normalizeTriageInfo,
  toAiTriageEngine,
  toStateDisplay,
  toStateTag,
} from "../models/aiTriage";
import {
  buildTriageRequest,
  derivePlatformBaseUrl,
  parseSsePhase,
} from "../services/aiTriageService";
import {
  buildAiTriageHtml,
  buildSourceMapFromRisks,
  classifyTriageSource,
  escapeHtml,
  mapResultToRow,
  mapResultsToRows,
} from "../views/aiTriageView/aiTriageViewProvider";

/** Build a minimal unsigned JWT carrying the given issuer. */
function tokenWithIssuer(iss: string): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/=+$/, "");
  return `${b64({ alg: "none" })}.${b64({ iss })}.sig`;
}

describe("AI Triage models", () => {
  describe("toAiTriageEngine / isAiTriageSupported", () => {
    it("maps sast and sca; rejects everything else", () => {
      expect(toAiTriageEngine("sast")).to.equal("sast");
      expect(toAiTriageEngine("SCA")).to.equal("sca");
      expect(toAiTriageEngine("kics")).to.equal(undefined);
      expect(toAiTriageEngine("sscs-secret-detection")).to.equal(undefined);
      expect(toAiTriageEngine(undefined)).to.equal(undefined);
      expect(isAiTriageSupported("sast")).to.equal(true);
      expect(isAiTriageSupported("containers")).to.equal(false);
    });
  });

  describe("state mapping", () => {
    it("converts display <-> tag both ways", () => {
      expect(toStateTag("Not Exploitable")).to.equal("NOT_EXPLOITABLE");
      expect(toStateTag("NOT_EXPLOITABLE")).to.equal("NOT_EXPLOITABLE");
      expect(toStateDisplay("NOT_EXPLOITABLE")).to.equal("Not Exploitable");
      expect(toStateDisplay("To Verify")).to.equal("To Verify");
    });

    it("handles unknown/custom states gracefully", () => {
      expect(toStateTag("Custom State")).to.equal("CUSTOM_STATE");
      expect(toStateDisplay("CUSTOM_STATE")).to.equal("Custom State");
      expect(toStateTag(undefined)).to.equal("");
      expect(toStateDisplay("")).to.equal("");
    });
  });

  describe("normalizeTriageInfo", () => {
    it("normalizes an object payload", () => {
      const result = normalizeTriageInfo({
        state: "NOT_EXPLOITABLE",
        severity: "HIGH",
        comment: "AI decided",
        confidence: 0.9,
      });
      expect(result).to.deep.equal({
        stateDisplay: "Not Exploitable",
        stateTag: "NOT_EXPLOITABLE",
        severity: "HIGH",
        comment: "AI decided",
        confidence: "0.9",
      });
    });

    it("accepts a bare state string", () => {
      expect(normalizeTriageInfo("Confirmed")?.stateTag).to.equal("CONFIRMED");
    });

    it("returns undefined when there is no usable state", () => {
      expect(normalizeTriageInfo(null)).to.equal(undefined);
      expect(normalizeTriageInfo({})).to.equal(undefined);
      expect(normalizeTriageInfo({ state: "   " })).to.equal(undefined);
    });
  });
});

describe("AI Triage service helpers", () => {
  describe("buildTriageRequest", () => {
    it("builds the documented request body", () => {
      const body = buildTriageRequest("scan-1", "sast", "hash-1");
      expect(body).to.deep.equal({
        scanID: "scan-1",
        buckets: [{ scannerType: "sast", resultIDs: ["hash-1"] }],
      });
    });
  });

  describe("derivePlatformBaseUrl", () => {
    it("uses the single-tenant issuer host directly", () => {
      const token = tokenWithIssuer("https://myco.ast.checkmarx.net/auth/realms/myco");
      expect(derivePlatformBaseUrl(token)).to.equal("https://myco.ast.checkmarx.net");
    });

    it("rewrites iam.checkmarx to ast.checkmarx for multi-tenant", () => {
      const token = tokenWithIssuer("https://iam.checkmarx.net/auth/realms/acme");
      expect(derivePlatformBaseUrl(token)).to.equal("https://ast.checkmarx.net");
    });

    it("falls back to a default when the token cannot be decoded", () => {
      expect(derivePlatformBaseUrl("not-a-jwt")).to.contain("https://");
    });
  });

  describe("parseSsePhase", () => {
    it("detects RUNNING and COMPLETED", () => {
      expect(parseSsePhase('data: {"currentPhase":"RUNNING"}')).to.equal(AiTriagePhase.running);
      expect(parseSsePhase('data: {"currentPhase":"COMPLETED"}')).to.equal(
        AiTriagePhase.completed
      );
    });

    it("returns the last phase seen in a multi-event chunk", () => {
      const chunk =
        'data: {"currentPhase":"RUNNING"}\n\ndata: {"currentPhase":"COMPLETED"}\n\n';
      expect(parseSsePhase(chunk)).to.equal(AiTriagePhase.completed);
    });

    it("returns undefined when no phase is present", () => {
      expect(parseSsePhase("data: keep-alive")).to.equal(undefined);
      expect(parseSsePhase("")).to.equal(undefined);
    });
  });
});

describe("AI Triage view rendering", () => {
  const sastResult = {
    type: "sast",
    severity: "critical",
    status: "NEW",
    state: "TO_VERIFY",
    similarityId: "sim-1",
    label: "SQL_Injection",
    id: "id-1",
    getResultHash: () => "hash-1",
  };

  describe("escapeHtml", () => {
    it("escapes HTML-significant characters", () => {
      expect(escapeHtml(`<a href="x">&'`)).to.equal("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
      expect(escapeHtml(undefined)).to.equal("");
    });
  });

  describe("mapResultToRow / mapResultsToRows", () => {
    it("maps a supported SAST result", () => {
      const row = mapResultToRow(sastResult);
      expect(row).to.include({
        resultId: "hash-1",
        similarityId: "sim-1",
        engine: "sast",
        severity: "CRITICAL",
        status: "NEW",
        stateDisplay: "To Verify",
        name: "SQL_Injection",
      });
    });

    it("skips unsupported engines and results missing identifiers", () => {
      expect(mapResultToRow({ type: "kics", similarityId: "s", getResultHash: () => "h" })).to.equal(
        undefined
      );
      expect(mapResultToRow({ type: "sast", similarityId: "", getResultHash: () => "" })).to.equal(
        undefined
      );
      const rows = mapResultsToRows([
        sastResult,
        { type: "kics", similarityId: "s", id: "i" },
        { type: "sca", similarityId: "sim-2", id: "id-2" },
      ]);
      expect(rows.map((r) => r.engine)).to.deep.equal(["sast", "sca"]);
    });

    it("defaults state to 'To Verify' when absent", () => {
      const row = mapResultToRow({ ...sastResult, state: "" });
      expect(row?.stateDisplay).to.equal("To Verify");
    });
  });

  describe("buildAiTriageHtml", () => {
    const baseArgs = {
      projectName: "my-proj",
      scanId: "scan-1",
      productName: "Checkmarx One Assist",
      nonce: "abc123",
      authenticated: true,
    };

    it("renders a table with the expected columns (no Status) and both AI actions", () => {
      const html = buildAiTriageHtml({ ...baseArgs, rows: mapResultsToRows([sastResult]) });
      ["Severity", "Engine", "Vulnerability", "State", "Triaged By"].forEach((col) =>
        expect(html).to.contain(`<th>${col}</th>`)
      );
      expect(html).to.not.contain("<th>Status</th>");
      expect(html).to.contain("SQL_Injection");
      expect(html).to.contain("Triage with AI");
      expect(html).to.contain("Remediate with AI");
      expect(html).to.contain('data-similarity="sim-1"');
      expect(html).to.contain(`nonce="abc123"`);
      expect(html).to.contain("Content-Security-Policy");
    });

    it("shows the completed icon for current-session triaged rows", () => {
      const html = buildAiTriageHtml({
        ...baseArgs,
        rows: mapResultsToRows([sastResult]),
        triagedIds: new Set(["sim-1"]),
      });
      expect(html).to.contain('class="ai-done"');
    });

    it("shows the completed icon for findings already triaged (non-'To Verify' state)", () => {
      const confirmed = { ...sastResult, state: "CONFIRMED", similarityId: "sim-9" };
      const html = buildAiTriageHtml({
        ...baseArgs,
        rows: mapResultsToRows([confirmed]),
        // no triagedIds => must be detected purely from the state
      });
      expect(html).to.contain('class="ai-done"');
    });

    it("does not show the icon for untriaged ('To Verify') findings", () => {
      const html = buildAiTriageHtml({ ...baseArgs, rows: mapResultsToRows([sastResult]) });
      expect(html).to.not.contain('class="ai-done"');
    });

    it("renders the 'Triaged By' source when provided", () => {
      const confirmed = { ...sastResult, state: "CONFIRMED", similarityId: "sim-9" };
      const html = buildAiTriageHtml({
        ...baseArgs,
        rows: mapResultsToRows([confirmed]),
        sourceBySimilarity: { "sim-9": "Manual" },
      });
      expect(html).to.contain('class="src-manual"');
    });

    it("shows a pending 'Triaged' source for triaged rows not yet resolved", () => {
      const confirmed = { ...sastResult, state: "CONFIRMED", similarityId: "sim-9" };
      const html = buildAiTriageHtml({ ...baseArgs, rows: mapResultsToRows([confirmed]) });
      expect(html).to.contain('class="src-triaged"');
    });

    it("shows an auth message when not authenticated", () => {
      const html = buildAiTriageHtml({ ...baseArgs, authenticated: false, rows: [] });
      expect(html).to.contain("Authentication to Checkmarx One is required");
      expect(html).to.not.contain("<th>Severity</th>");
    });

    it("prompts to select a scan when project/scan missing", () => {
      const html = buildAiTriageHtml({
        ...baseArgs,
        projectName: undefined,
        scanId: undefined,
        rows: [],
      });
      expect(html).to.contain("Select a project and scan");
    });

    it("shows an empty message when there are no triage-able findings", () => {
      const html = buildAiTriageHtml({ ...baseArgs, rows: [] });
      expect(html).to.contain("No SAST or SCA findings");
    });
  });
});

describe("classifyTriageSource", () => {
  it("classifies human authors as Manual", () => {
    expect(classifyTriageSource("john.doe@acme.com")).to.equal("Manual");
    expect(classifyTriageSource("Jane Smith")).to.equal("Manual");
  });

  it("classifies AI/system/empty authors as AI", () => {
    expect(classifyTriageSource("")).to.equal("AI");
    expect(classifyTriageSource("checkmarx-ai")).to.equal("AI");
    expect(classifyTriageSource("system")).to.equal("AI");
    expect(classifyTriageSource("Bot", "AI generated triage")).to.equal("AI");
  });
});

describe("buildSourceMapFromRisks (Risks API stateChangedBy)", () => {
  it("maps AI / manual and omits unchanged, keyed by similarityId", () => {
    const risks = [
      { similarityId: "-101", stateChangedBy: "AI" },
      { similarityId: "-202", stateChangedBy: "manual" },
      { similarityId: "-303", stateChangedBy: "unchanged" },
      { similarityId: "-404" }, // missing field
    ];
    const map = buildSourceMapFromRisks(risks);
    expect(map["-101"]).to.equal("AI");
    expect(map["-202"]).to.equal("Manual");
    expect(map).to.not.have.property("-303");
    expect(map).to.not.have.property("-404");
  });

  it("is case-insensitive and tolerates alternate id/field names", () => {
    const map = buildSourceMapFromRisks([
      { hash: "h1", state_changed_by: "Ai" },
      { id: "i1", stateChangedBy: "MANUAL" },
    ]);
    expect(map["h1"]).to.equal("AI");
    expect(map["i1"]).to.equal("Manual");
  });

  it("indexes by groupId/id and uses isAiGenerated as a fallback", () => {
    const map = buildSourceMapFromRisks([
      { groupId: "-999", stateChangedBy: "manual" },
      { id: "risk-1", groupId: "-888", isAiGenerated: true }, // no stateChangedBy
    ]);
    expect(map["-999"]).to.equal("Manual");
    expect(map["-888"]).to.equal("AI");
    expect(map["risk-1"]).to.equal("AI");
  });

  it("returns an empty map for empty/undefined input", () => {
    expect(buildSourceMapFromRisks(undefined)).to.deep.equal({});
    expect(buildSourceMapFromRisks([])).to.deep.equal({});
  });
});
