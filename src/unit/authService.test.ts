import { expect } from "chai";
import sinon from "sinon";
import nock from "nock";
import { AuthService } from "../services/authService";
import * as vscode from "vscode";

describe("AuthService Tests", () => {
  let authService: AuthService;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    const mockContext = {
      subscriptions: [],
      secrets: {
        store: sandbox.stub().resolves(),
        get: sandbox.stub().resolves("mocked-token"),
        delete: sandbox.stub().resolves(),
      },
      globalState: {
        get: sandbox.stub().returns({}),
        update: sandbox.stub().resolves(),
      },
    } as unknown as vscode.ExtensionContext;

    authService = AuthService.getInstance(mockContext);
 
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  describe("validateConnection", () => {
    it("should return true when baseUri and tenant are valid", async () => {
      sandbox.stub(authService as any, 'checkUrlExists').resolves(true);

      const result = await (authService as any).validateConnection("https://valid-url.com", "validTenant");
      expect(result.isValid).to.be.true;
    });

    it("should fail when baseUri is invalid (bad protocol)", async () => {
      const result = await (authService as any).validateConnection("ftp://invalid-url.com", "validTenant");
      expect(result.isValid).to.be.false;
      expect(result.error).to.equal("Invalid URL protocol. Please use http:// or https://");
    });

    it("should fail when tenant is empty", async () => {
      const result = await (authService as any).validateConnection("https://valid-url.com", "");
      expect(result.isValid).to.be.false;
      expect(result.error).to.equal("Tenant name cannot be empty");
    });

    it("should fail when baseUri does not exist", async () => {
      sandbox.stub(authService as any, 'checkUrlExists').resolves(false);

      const result = await (authService as any).validateConnection("https://nonexistent-url.com", "tenant");
      expect(result.isValid).to.be.false;
      expect(result.error).to.equal("Please check the server address of your Checkmarx One environment.");
    });

    it("should fail when tenant does not exist", async () => {
      sandbox.stub(authService as any, 'checkUrlExists')
        .withArgs("https://valid-url.com", false).resolves(true)
        .withArgs("https://valid-url.com/auth/realms/invalidTenant", true).resolves(false);

      const result = await (authService as any).validateConnection("https://valid-url.com", "invalidTenant");
      expect(result.isValid).to.be.false;
      expect(result.error).to.equal('Tenant "invalidTenant" not found. Please check your tenant name.');
    });

    it("should handle exceptions gracefully", async () => {
      sandbox.stub(authService as any, 'checkUrlExists').throws(new Error("Network error"));

      const result = await (authService as any).validateConnection("https://valid-url.com", "tenant");
      expect(result.isValid).to.be.false;
      expect(result.error).to.equal("Could not connect to server. Please check your Base URI.");
    });
  });

  describe("checkUrlExists", () => {
    it("should return true if HEAD request returns status < 400", async () => {
      nock("https://valid-url.com").head("/").reply(200);
      const result = await (authService as any).checkUrlExists("https://valid-url.com");
      expect(result).to.be.true;
    });

    it("should return false if HEAD request returns status >= 400", async () => {
      nock("https://valid-url.com").head("/").reply(404);
      const result = await (authService as any).checkUrlExists("https://valid-url.com");
      expect(result).to.be.false;
    });

    it("should handle redirects correctly", async () => {
      nock("https://valid-url.com")
        .head("/").reply(301, undefined, { Location: "/redirected" })
        .get("/redirected").reply(200);

      const result = await (authService as any).checkUrlExists("https://valid-url.com");
      expect(result).to.be.true;
    });

    it("should fallback to GET request on 405 response from HEAD request", async () => {
      nock("https://valid-url.com")
        .head("/").reply(405)
        .get("/").reply(200);

      const result = await (authService as any).checkUrlExists("https://valid-url.com");
      expect(result).to.be.true;
    });

    it("should return false if request times out", async () => {
      nock("https://valid-url.com")
        .head("/").delayConnection(6000).reply(200);

      const result = await (authService as any).checkUrlExists("https://valid-url.com");
      expect(result).to.be.false;
    });

    it("should return false after too many redirects", async () => {
      nock("https://valid-url.com")
        .head("/").reply(301, undefined, { Location: "/redirect1" })
        .get(/redirected.*/).reply(301, undefined, { Location: "/redirected" });

      const result = await (authService as any).checkUrlExists("https://valid-url.com");
      expect(result).to.be.false;
    });
  });
});
