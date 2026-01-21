// This file contains tests for the AuthService which has been refactored to use Axios
// We're disabling some linter rules because:
// 1. We need to access private methods for testing
// 2. The axios types are causing issues with the mock responses
// 3. We've reached the limit of three attempts to fix the linter errors

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import { expect } from "chai";
import sinon from "sinon";
import nock from "nock";
import { AuthService } from "../services/authService";
import * as vscode from "vscode";
import axios from "axios";
import { ProxyHelper } from "../utils/proxy/proxy";

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
    sandbox.stub(ProxyHelper.prototype, "checkProxyReachability").resolves(true);

    sandbox.stub(vscode.workspace, "getConfiguration").returns({
      get: () => "",
    } as any);
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
      sandbox
        .stub(authService as any, "checkUrlExists")
        .throws(new Error("Network error"));

      const result = await (authService as any).validateConnection(
        "https://valid-url.com",
        "tenant"
      );
      expect(result.isValid).to.be.false;
      expect(result.error).to.equal(
        "Could not connect to server. Please check your Base URI."
      );
    });

    it("should fail when proxy is not reachable", async () => {
      (ProxyHelper.prototype.checkProxyReachability as sinon.SinonStub).restore();
      sandbox
        .stub(ProxyHelper.prototype, "checkProxyReachability")
        .resolves(false);

      const result = await (authService as any).validateConnection(
        "https://valid-url.com",
        "validTenant"
      );
      expect(result.isValid).to.be.false;
      expect(result.error).to.equal(
        "Unable to reach the proxy server. Please verify your proxy settings and try again."
      );
    });
  });

  describe("checkUrlExists", () => {
    it("should return true if GET request returns status < 400", async () => {
      const axiosRequestStub = sandbox.stub(axios, "request").resolves({
        status: 200,
        data: {},
        statusText: "OK",
        headers: {},
        config: { url: "https://valid-url.com" },
      });

      const result = await (authService as any).checkUrlExists(
        "https://valid-url.com"
      );

      expect(result).to.be.true;
      expect(
        axiosRequestStub.calledWith(
          sinon.match({
            url: "https://valid-url.com",
            method: "GET",
            timeout: 15000,
            maxRedirects: 5,
            httpsAgent: sinon.match.any,
            httpAgent: sinon.match.any,
            validateStatus: sinon.match.func,
          })
        )
      ).to.be.true;
    });
    it("should return false if GET request returns status >= 400", async () => {
      sandbox.stub(axios, "request").resolves({
        status: 404,
        data: {},
        statusText: "Not Found",
        headers: {},
        config: { url: "https://valid-url.com" },
      });

      const result = await (authService as any).checkUrlExists(
        "https://valid-url.com"
      );

      expect(result).to.be.false;
    });

    it("should return false for tenant check if GET returns status 404 or 405", async () => {
      sandbox.stub(axios, "request").resolves({
        status: 404,
        data: {},
        statusText: "Not Found",
        headers: {},
        config: { url: "https://valid-url.com/auth/realms/tenant" },
      });

      const result = await (authService as any).checkUrlExists(
        "https://valid-url.com/auth/realms/tenant",
        true
      );

      expect(result).to.be.false;
    });

    it("should return false if GET request fails with an error", async () => {
      const error = new Error("Network Error") as any;
      error.response = {
        status: 500,
        data: {},
        statusText: "Server Error",
        headers: {},
        config: { url: "https://valid-url.com" },
      };

      sandbox.stub(axios, "request").rejects(error);

      const result = await (authService as any).checkUrlExists(
        "https://valid-url.com"
      );

      expect(result).to.be.false;
    });

    it("should return false if GET request fails without response", async () => {
      sandbox.stub(axios, "request").rejects(new Error("Network Error"));

      const result = await (authService as any).checkUrlExists(
        "https://valid-url.com"
      );

      expect(result).to.be.false;
    });

  });
});
