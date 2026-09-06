/* eslint-disable @typescript-eslint/no-explicit-any */
import "./mocks/vscode-mock";
import { expect } from "chai";
import sinon from "sinon";
import nock from "nock";
import * as vscode from "vscode";
import { AuthService } from "../services/authService";
import { ProxyHelper } from "../utils/proxy/proxy";
import {
  AiTriageService,
  AiTriageError,
  AiTriageErrorKind,
} from "../services/aiTriageService";

const HOST = "https://tenant.ast.checkmarx.net";

/** Unsigned JWT whose issuer resolves to HOST. */
function makeToken(): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/=+$/, "");
  return `${b64({ alg: "none" })}.${b64({
    iss: "https://tenant.ast.checkmarx.net/auth/realms/tenant",
  })}.sig`;
}

describe("AiTriageService", () => {
  let sandbox: sinon.SinonSandbox;
  const context = {} as vscode.ExtensionContext;

  function stubToken(token: string | undefined): void {
    sandbox
      .stub(AuthService, "getInstance")
      .returns({ getToken: () => Promise.resolve(token) } as any);
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    // No proxy in tests -> direct connection that nock can intercept.
    sandbox.stub(ProxyHelper.prototype, "createHttpsProxyAgent").returns(undefined as any);
    AiTriageService.reset();
    if (!nock.isActive()) {
      nock.activate();
    }
    // The service exchanges the stored refresh/offline token for an access token
    // (POST to the realm token endpoint) before every API call.
    nock(HOST)
      .persist()
      .post("/auth/realms/tenant/protocol/openid-connect/token")
      .reply(200, { access_token: "access-token-1", expires_in: 300 });
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
    AiTriageService.reset();
  });

  describe("submitTriage", () => {
    it("posts the request and parses a 202 Accepted response", async () => {
      stubToken(makeToken());
      const scope = nock(HOST)
        .post("/api/ai-triage/triage")
        .reply(202, {
          scanID: "scan-1",
          status: "accepted",
          triageID: "triage-1",
          published: true,
          existingTriageState: null,
        });

      const service = AiTriageService.getInstance(context);
      const res = await service.submitTriage("scan-1", "sast", "hash-1");

      expect(res.status).to.equal("accepted");
      expect(res.triageID).to.equal("triage-1");
      expect(res.published).to.equal(true);
      expect(scope.isDone()).to.equal(true);
    });

    it("maps 403 to a permission error", async () => {
      stubToken(makeToken());
      nock(HOST).post("/api/ai-triage/triage").reply(403, {});
      const service = AiTriageService.getInstance(context);
      try {
        await service.submitTriage("scan-1", "sast", "hash-1");
        expect.fail("should have thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(AiTriageError);
        expect((error as AiTriageError).kind).to.equal(AiTriageErrorKind.permission);
      }
    });

    it("maps 401 to an authentication error", async () => {
      stubToken(makeToken());
      nock(HOST).post("/api/ai-triage/triage").reply(401, {});
      const service = AiTriageService.getInstance(context);
      try {
        await service.submitTriage("scan-1", "sast", "hash-1");
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as AiTriageError).kind).to.equal(AiTriageErrorKind.authentication);
      }
    });

    it("throws an authentication error when there is no token", async () => {
      stubToken(undefined);
      const service = AiTriageService.getInstance(context);
      try {
        await service.submitTriage("scan-1", "sast", "hash-1");
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as AiTriageError).kind).to.equal(AiTriageErrorKind.authentication);
      }
    });

    it("maps transport failures to a network error", async () => {
      stubToken(makeToken());
      nock(HOST).post("/api/ai-triage/triage").replyWithError("boom");
      const service = AiTriageService.getInstance(context);
      try {
        await service.submitTriage("scan-1", "sast", "hash-1");
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as AiTriageError).kind).to.equal(AiTriageErrorKind.network);
      }
    });
  });

  describe("getTriageInfo", () => {
    it("returns the parsed info object", async () => {
      stubToken(makeToken());
      nock(HOST)
        .get("/api/aitriage/triage/proj/sim-1")
        .reply(200, { state: "NOT_EXPLOITABLE", comment: "ai" });
      const service = AiTriageService.getInstance(context);
      const info = await service.getTriageInfo("proj", "sim-1");
      expect(info?.state).to.equal("NOT_EXPLOITABLE");
    });

    it("returns undefined on 404", async () => {
      stubToken(makeToken());
      nock(HOST).get("/api/aitriage/triage/proj/sim-1").reply(404, {});
      const service = AiTriageService.getInstance(context);
      const info = await service.getTriageInfo("proj", "sim-1");
      expect(info).to.equal(undefined);
    });
  });

  describe("pollUntilResolved", () => {
    it("returns once the state changes from the previous value", async () => {
      stubToken(makeToken());
      nock(HOST)
        .get("/api/aitriage/triage/proj/sim-1")
        .reply(200, { state: "To Verify" })
        .get("/api/aitriage/triage/proj/sim-1")
        .reply(200, { state: "Not Exploitable" });

      const service = AiTriageService.getInstance(context);
      const info = await service.pollUntilResolved("proj", "sim-1", {
        previousState: "To Verify",
        intervalMs: 5,
        timeoutMs: 2000,
      });
      expect(info?.state).to.equal("Not Exploitable");
    });

    it("times out when no decision arrives", async () => {
      stubToken(makeToken());
      nock(HOST)
        .persist()
        .get("/api/aitriage/triage/proj/sim-1")
        .reply(200, { state: "To Verify" });

      const service = AiTriageService.getInstance(context);
      try {
        await service.pollUntilResolved("proj", "sim-1", {
          previousState: "To Verify",
          intervalMs: 5,
          timeoutMs: 40,
        });
        expect.fail("should have thrown");
      } catch (error) {
        expect((error as AiTriageError).kind).to.equal(AiTriageErrorKind.timeout);
      }
    });
  });

  describe("resolveScaResultId", () => {
    it("resolves the Risks API's own risk-hash id when the CVE/riskName matches", async () => {
      stubToken(makeToken());
      nock(HOST)
        .get("/api/risks")
        .query(true)
        .reply(200, [
          { id: "bZ2wOA1Z8MmjhUWYNzzde3AOwVg1F830SiCAt0RPvJk=", riskName: "CVE-2026-33228" },
        ]);

      const service = AiTriageService.getInstance(context);
      const resultId = await service.resolveScaResultId(
        "proj",
        ["cve-2026-33228", "cve-2026-33228"],
        "cve-2026-33228"
      );
      expect(resultId).to.equal("bZ2wOA1Z8MmjhUWYNzzde3AOwVg1F830SiCAt0RPvJk=");
    });

    it("matches case-insensitively on similarityId/groupId/hash as well as riskName", async () => {
      stubToken(makeToken());
      nock(HOST)
        .get("/api/risks")
        .query(true)
        .reply(200, [{ id: "risk-hash-1", groupId: "CVE-2026-1#-#Npm-x-1.0.0#-#proj" }]);

      const service = AiTriageService.getInstance(context);
      const resultId = await service.resolveScaResultId(
        "proj",
        ["cve-2026-1#-#npm-x-1.0.0#-#proj"],
        "cve-2026-1"
      );
      expect(resultId).to.equal("risk-hash-1");
    });

    it("falls back to the given fallback when no risk item matches", async () => {
      stubToken(makeToken());
      nock(HOST)
        .get("/api/risks")
        .query(true)
        .reply(200, [{ id: "other-hash", riskName: "CVE-9999-0001" }]);

      const service = AiTriageService.getInstance(context);
      const resultId = await service.resolveScaResultId(
        "proj",
        ["cve-2026-33228"],
        "cve-2026-33228"
      );
      expect(resultId).to.equal("cve-2026-33228");
    });

    it("falls back to the given fallback when the Risks API call fails", async () => {
      stubToken(makeToken());
      nock(HOST).get("/api/risks").query(true).replyWithError("boom");

      const service = AiTriageService.getInstance(context);
      const resultId = await service.resolveScaResultId(
        "proj",
        ["cve-2026-33228"],
        "cve-2026-33228"
      );
      expect(resultId).to.equal("cve-2026-33228");
    });

    it("returns the fallback without calling the API when no identifiers are given", async () => {
      stubToken(makeToken());
      const scope = nock(HOST).get("/api/risks").query(true).reply(200, []);

      const service = AiTriageService.getInstance(context);
      const resultId = await service.resolveScaResultId("proj", [undefined, ""], "cve-2026-33228");
      expect(resultId).to.equal("cve-2026-33228");
      expect(scope.isDone()).to.equal(false);
    });
  });

  describe("runTriage (end to end, polling monitor)", () => {
    it("submits then resolves the decision via the info API", async () => {
      stubToken(makeToken());
      nock(HOST)
        .post("/api/ai-triage/triage")
        .reply(202, { scanID: "scan-1", status: "accepted", triageID: "t", published: true, existingTriageState: null })
        .get("/api/aitriage/triage/proj/sim-1")
        .reply(200, { state: "NOT_EXPLOITABLE" });

      const service = AiTriageService.getInstance(context);
      const result = await service.runTriage({
        scanId: "scan-1",
        projectId: "proj",
        engine: "sast",
        resultId: "hash-1",
        similarityId: "sim-1",
      });
      expect(result.stateTag).to.equal("NOT_EXPLOITABLE");
      expect(result.stateDisplay).to.equal("Not Exploitable");
    });
  });
});
