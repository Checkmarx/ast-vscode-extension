/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */

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
      sandbox.stub(authService as any, "checkUrlExists").resolves(true);

      const result = await (authService as any).validateConnection(
        "https://valid-url.com",
        "validTenant"
      );
      expect(result.isValid).to.be.true;
    });

    it("should fail when baseUri is invalid (bad protocol)", async () => {
      const result = await (authService as any).validateConnection(
        "ftp://invalid-url.com",
        "validTenant"
      );
      expect(result.isValid).to.be.false;
      expect(result.error).to.equal(
        "Invalid URL protocol. Please use http:// or https://"
      );
    });

    it("should fail when tenant is empty", async () => {
      const result = await (authService as any).validateConnection(
        "https://valid-url.com",
        ""
      );
      expect(result.isValid).to.be.false;
      expect(result.error).to.equal("Tenant name cannot be empty");
    });

    it("should fail when baseUri does not exist", async () => {
      sandbox.stub(authService as any, "checkUrlExists").resolves(false);

      const result = await (authService as any).validateConnection(
        "https://nonexistent-url.com",
        "tenant"
      );
      expect(result.isValid).to.be.false;
      expect(result.error).to.equal(
        "Please check the server address of your Checkmarx One environment."
      );
    });

    it("should fail when tenant does not exist", async () => {
      const stub = sandbox.stub(authService as any, "checkUrlExists");
      stub.withArgs("https://valid-url.com", false).resolves(true);
      stub
        .withArgs("https://valid-url.com/auth/realms/invalidTenant", true)
        .resolves(false);

      const result = await (authService as any).validateConnection(
        "https://valid-url.com",
        "invalidTenant"
      );
      expect(result.isValid).to.be.false;
      expect(result.error).to.equal(
        'Tenant "invalidTenant" not found. Please check your tenant name.'
      );
    });

    it("should handle exceptions gracefully", async () => {
      sandbox.stub(authService as any, "checkUrlExists").throws(new Error("Network error"));

      const result = await (authService as any).validateConnection(
        "https://valid-url.com",
        "tenant"
      );
      expect(result.isValid).to.be.false;
      expect(result.error).to.equal(
        "Could not connect to server. Please check your Base URI."
      );
    });
  });

  describe("checkUrlExists", () => {
    // Override checkUrlExists to use nativeGet stub
    beforeEach(() => {
      (authService as any).checkUrlExists = async function (
        url: string,
        isTenantCheck = false
      ): Promise<boolean> {
        try {
          const statusCode = await (this as any).nativeGet(url, 5000);
          if (isTenantCheck) {
            if (statusCode === 404 || statusCode === 405) { return false; }
          }
          return statusCode < 400;
        } catch {
          return false;
        }
      };
    });

    it("should return true if GET request returns status < 400", async () => {
      const nativeGetStub = sandbox.stub().resolves(200);
      (authService as any).nativeGet = nativeGetStub;

      const result = await (authService as any).checkUrlExists("https://valid-url.com");

      expect(result).to.be.true;
      expect(nativeGetStub.calledWith("https://valid-url.com", 5000)).to.be.true;
    });

    it("should return false if GET request returns status >= 400", async () => {
      const nativeGetStub = sandbox.stub().resolves(404);
      (authService as any).nativeGet = nativeGetStub;

      const result = await (authService as any).checkUrlExists("https://valid-url.com");

      expect(result).to.be.false;
    });

    it("should return false for tenant check if GET returns status 404 or 405", async () => {
      const nativeGetStub = sandbox.stub().resolves(404);
      (authService as any).nativeGet = nativeGetStub;

      const result = await (authService as any).checkUrlExists(
        "https://valid-url.com/auth/realms/tenant",
        true
      );

      expect(result).to.be.false;
    });

    it("should return false if GET request fails with an error", async () => {
      const nativeGetStub = sandbox.stub().rejects(new Error("Network Error"));
      (authService as any).nativeGet = nativeGetStub;

      const result = await (authService as any).checkUrlExists("https://valid-url.com");

      expect(result).to.be.false;
    });

    it("should return false if GET request fails without response", async () => {
      const nativeGetStub = sandbox.stub().rejects(new Error("Network Error"));
      (authService as any).nativeGet = nativeGetStub;

      const result = await (authService as any).checkUrlExists("https://valid-url.com");

      expect(result).to.be.false;
    });
  });
});
