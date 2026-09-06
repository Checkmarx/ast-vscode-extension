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
  AiTriageRow,
  buildAiTriageHtml,
  buildRiskNameMapFromRisks,
  buildSourceMapFromRisks,
  classifyTriageSource,
  escapeHtml,
  lookupByRow,
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

    it("carries alternateId through when present, and defaults to '' when absent", () => {
      expect(mapResultToRow(sastResult)?.alternateId).to.equal("");
      expect(mapResultToRow({ ...sastResult, alternateId: "risk-hash-1" })?.alternateId).to.equal(
        "risk-hash-1"
      );
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
      ["Severity", "Engine", "RiskName", "Vulnerability", "State", "Triaged By"].forEach((col) =>
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

    it("renders the RiskName cell when provided, and a placeholder when not", () => {
      const withRiskName = buildAiTriageHtml({
        ...baseArgs,
        rows: mapResultsToRows([sastResult]),
        riskNameBySimilarity: { "sim-1": "Vulnerable and Outdated Components" },
      });
      expect(withRiskName).to.contain('td class="riskname"');
      expect(withRiskName).to.contain("Vulnerable and Outdated Components");

      const withoutRiskName = buildAiTriageHtml({ ...baseArgs, rows: mapResultsToRows([sastResult]) });
      expect(withoutRiskName).to.contain('<td class="riskname" data-sim="sim-1" title=""><span class="src-none">—</span></td>');
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

describe("buildRiskNameMapFromRisks (Risks API riskName)", () => {
  it("maps riskName keyed by similarityId, tolerating alternate id/field names", () => {
    const map = buildRiskNameMapFromRisks([
      { similarityId: "-101", riskName: "Vulnerable and Outdated Components" },
      { hash: "h1", risk_name: "SQL Injection" },
      { id: "-404" }, // missing riskName
    ]);
    expect(map["-101"]).to.equal("Vulnerable and Outdated Components");
    expect(map["h1"]).to.equal("SQL Injection");
    expect(map).to.not.have.property("-404");
  });

  it("indexes by groupId/id in addition to similarityId", () => {
    const map = buildRiskNameMapFromRisks([
      { groupId: "-999", riskName: "Broken Access Control" },
      { id: "risk-1", riskName: "Insecure Deserialization" },
    ]);
    expect(map["-999"]).to.equal("Broken Access Control");
    expect(map["risk-1"]).to.equal("Insecure Deserialization");
  });

  it("returns an empty map for empty/undefined input", () => {
    expect(buildRiskNameMapFromRisks(undefined)).to.deep.equal({});
    expect(buildRiskNameMapFromRisks([])).to.deep.equal({});
  });

  it("is keyed by riskName itself, case-insensitively (SCA: local id is the lower-cased CVE/risk id)", () => {
    // Regression test: a real captured scan sample has a local SCA result with
    // id/similarityId "cve-2011-3374", while the Risks API returns the same
    // vulnerability as riskName "CVE-2011-3374" (upper-case) — and for findings
    // with no CVE, riskName is an internal "Cx..." id instead (still lower-cased
    // on the local side). Neither the risk's own `id`/`hash`/`groupId` fields
    // match the local result at all — riskName is the only key that does.
    const map = buildRiskNameMapFromRisks([
      {
        id: "0KxUMfzMm0kh5W4Km909vlN0VMf7jWefhVJ1guHCtsU=",
        riskName: "CVE-2026-13676",
        groupId: "CVE-2026-13676#-#Npm-fast-uri-3.0.6#-#907fe279-51d0-4f5e-8c94-4a57cd984d28",
      },
      {
        id: "3IJd+Bt33rlaM/MP2ubtTm88BKMMaxNe5bBwKjJ0XeY=",
        riskName: "Cxf5fb15b0-6576",
        groupId: "Cxf5fb15b0-6576#-#Npm-serialize-javascript-6.0.2#-#907fe279-51d0-4f5e-8c94-4a57cd984d28",
      },
    ]);
    expect(map["cve-2026-13676"]).to.equal("CVE-2026-13676");
    expect(map["cxf5fb15b0-6576"]).to.equal("Cxf5fb15b0-6576");
  });
});

describe("lookupByRow (row -> Risks-API-derived map correlation)", () => {
  function makeRow(overrides: Partial<AiTriageRow>): AiTriageRow {
    return {
      resultId: "",
      similarityId: "",
      alternateId: "",
      engine: "sca",
      resultType: "sca",
      severity: "HIGH",
      status: "",
      stateDisplay: "To Verify",
      name: "",
      description: "",
      ...overrides,
    };
  }

  it("matches an SCA row via its (lower-cased) CVE id against the riskName-keyed map", () => {
    const riskNameMap = buildRiskNameMapFromRisks([
      { id: "hash-1", riskName: "CVE-2026-13676" },
    ]);
    const row = makeRow({ resultId: "cve-2026-13676", similarityId: "cve-2026-13676" });
    expect(lookupByRow(riskNameMap, row)).to.equal("CVE-2026-13676");
  });

  it("prefers alternateId when present, but falls back to similarityId/resultId", () => {
    const map = { "alt-1": "A", "sim-1": "B", "res-1": "C" };
    expect(lookupByRow(map, makeRow({ alternateId: "alt-1", similarityId: "sim-1", resultId: "res-1" }))).to.equal("A");
    expect(lookupByRow(map, makeRow({ similarityId: "sim-1", resultId: "res-1" }))).to.equal("B");
    expect(lookupByRow(map, makeRow({ resultId: "res-1" }))).to.equal("C");
  });

  it("returns undefined when no identifier matches", () => {
    expect(lookupByRow({ "some-key": "value" }, makeRow({ resultId: "other" }))).to.equal(undefined);
  });
});
