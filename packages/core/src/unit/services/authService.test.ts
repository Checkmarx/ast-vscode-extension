/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { AuthService } from "../../services/authService";
import { constants } from "../../utils/common/constants";
import axios from "axios";

describe("AuthService", () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: any;
  let authService: AuthService;
  let axiosStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    mockContext = {
      subscriptions: [],
      globalState: {
        get: sandbox.stub().returns(undefined),
        update: sandbox.stub().resolves(),
      },
      extensionUri: vscode.Uri.parse("file:///test"),
      extensionPath: "/test",
      secrets: {
        store: sandbox.stub().resolves(),
        get: sandbox.stub().resolves("test-token"),
        delete: sandbox.stub().resolves(),
      },
    };

    axiosStub = sandbox.stub(axios, "request");
    sandbox.stub(vscode.env, "openExternal").resolves(true);
    sandbox.stub(vscode.window, "showInformationMessage").resolves();
    sandbox.stub(vscode.commands, "executeCommand" as any).resolves();

    // Reset singleton
    (AuthService as any).instance = undefined;
    authService = AuthService.getInstance(mockContext);
  });

  afterEach(() => {
    sandbox.restore();
    (AuthService as any).instance = undefined;
  });

  describe("getInstance", () => {
    it("should return same instance on multiple calls", () => {
      const service1 = AuthService.getInstance(mockContext);
      const service2 = AuthService.getInstance(mockContext);
      expect(service1).to.equal(service2);
    });

    it("should create new instance when called first time", () => {
      (AuthService as any).instance = undefined;
      const service = AuthService.getInstance(mockContext);
      expect(service).to.exist;
    });

    it("should initialize with context", () => {
      expect(authService).to.exist;
    });

    it("should accept optional logs parameter", () => {
      (AuthService as any).instance = undefined;
      const mockLogs = { info: sandbox.stub() } as any;
      const service = AuthService.getInstance(mockContext, mockLogs);
      expect(service).to.exist;
    });
  });

  describe("validateApiKey", () => {
    it("should store API key when validation succeeds", async () => {
      const mockCx = {
        authValidate: sandbox.stub().resolves(true),
      };
      sandbox.stub(authService as any, "getCx" as any).returns(mockCx);

      const result = await authService.validateApiKey("valid-key");

      expect(result).to.be.true;
      expect(mockContext.secrets.store.called).to.be.true;
    });

    it("should delete API key when validation fails", async () => {
      const mockCx = {
        authValidate: sandbox.stub().resolves(false),
      };
      sandbox.stub(authService as any, "getCx" as any).returns(mockCx);

      const result = await authService.validateApiKey("invalid-key");

      expect(result).to.be.false;
      expect(mockContext.secrets.delete.called).to.be.true;
    });

    it("should return false on error", async () => {
      sandbox.stub(mockContext.secrets, "store").rejects(new Error("Storage error"));

      const result = await authService.validateApiKey("key");

      expect(result).to.be.false;
    });

    it("should handle empty API key", async () => {
      const result = await authService.validateApiKey("");
      expect(result).to.be.false;
    });
  });

  describe("getToken", () => {
    it("should return token from secrets", async () => {
      mockContext.secrets.get.resolves("my-token");

      const token = await authService.getToken();

      expect(token).to.equal("my-token");
    });

    it("should return undefined when no token stored", async () => {
      mockContext.secrets.get.resolves(undefined);

      const token = await authService.getToken();

      expect(token).to.be.undefined;
    });
  });

  describe("saveLastAuthMethod", () => {
    it("should save oauth method", async () => {
      await authService.saveLastAuthMethod("oauth");

      expect(mockContext.globalState.update.called).to.be.true;
      const call = mockContext.globalState.update.getCall(0);
      expect(call.args[0]).to.equal(constants.getLastAuthMethodKey());
      expect(call.args[1]).to.equal("oauth");
    });

    it("should save apiKey method", async () => {
      await authService.saveLastAuthMethod("apiKey");

      expect(mockContext.globalState.update.called).to.be.true;
      const call = mockContext.globalState.update.getCall(0);
      expect(call.args[1]).to.equal("apiKey");
    });
  });

  describe("getLastAuthMethod", () => {
    it("should return oauth when saved", () => {
      mockContext.globalState.get.returns("oauth");

      const method = authService.getLastAuthMethod();

      expect(method).to.equal("oauth");
    });

    it("should return apiKey when saved", () => {
      mockContext.globalState.get.returns("apiKey");

      const method = authService.getLastAuthMethod();

      expect(method).to.equal("apiKey");
    });

    it("should return undefined when not set", () => {
      mockContext.globalState.get.returns(undefined);

      const method = authService.getLastAuthMethod();

      expect(method).to.be.undefined;
    });
  });

  describe("saveOAuthCredentials", () => {
    it("should save baseUri and tenant", async () => {
      await authService.saveOAuthCredentials("https://example.com", "my-tenant");

      expect(mockContext.globalState.update.callCount).to.equal(2);
    });

    it("should handle empty baseUri", async () => {
      await authService.saveOAuthCredentials("", "tenant");
      expect(mockContext.globalState.update.called).to.be.true;
    });

    it("should handle empty tenant", async () => {
      await authService.saveOAuthCredentials("https://example.com", "");
      expect(mockContext.globalState.update.called).to.be.true;
    });
  });

  describe("getStoredOAuthCredentials", () => {
    it("should return credentials when both are stored", () => {
      mockContext.globalState.get.withArgs(constants.getLastOAuthBaseUriKey()).returns("https://api.cx.com");
      mockContext.globalState.get.withArgs(constants.getLastOAuthTenantKey()).returns("tenant1");

      const creds = authService.getStoredOAuthCredentials();

      expect(creds).to.exist;
      expect(creds?.baseUri).to.equal("https://api.cx.com");
      expect(creds?.tenant).to.equal("tenant1");
    });

    it("should return undefined when baseUri missing", () => {
      mockContext.globalState.get.returns(undefined);

      const creds = authService.getStoredOAuthCredentials();

      expect(creds).to.be.undefined;
    });

    it("should return undefined when tenant missing", () => {
      mockContext.globalState.get.withArgs(constants.getLastOAuthBaseUriKey()).returns("https://api.cx.com");
      mockContext.globalState.get.withArgs(constants.getLastOAuthTenantKey()).returns(undefined);

      const creds = authService.getStoredOAuthCredentials();

      expect(creds).to.be.undefined;
    });
  });

  describe("hasOAuthCredentials", () => {
    it("should return true when all conditions met", async () => {
      mockContext.secrets.get.resolves("token");
      mockContext.globalState.get.withArgs(constants.getLastOAuthBaseUriKey()).returns("https://api.cx.com");
      mockContext.globalState.get.withArgs(constants.getLastOAuthTenantKey()).returns("tenant");
      mockContext.globalState.get.withArgs(constants.getLastAuthMethodKey()).returns("oauth");

      const result = await authService.hasOAuthCredentials();

      expect(result).to.be.true;
    });

    it("should return false when token missing", async () => {
      mockContext.secrets.get.resolves(undefined);

      const result = await authService.hasOAuthCredentials();

      expect(result).to.be.false;
    });

    it("should return false when oauth creds missing", async () => {
      mockContext.secrets.get.resolves("token");
      mockContext.globalState.get.returns(undefined);

      const result = await authService.hasOAuthCredentials();

      expect(result).to.be.false;
    });

    it("should return false when auth method is apiKey", async () => {
      mockContext.secrets.get.resolves("token");
      mockContext.globalState.get.withArgs(constants.getLastOAuthBaseUriKey()).returns("uri");
      mockContext.globalState.get.withArgs(constants.getLastOAuthTenantKey()).returns("tenant");
      mockContext.globalState.get.withArgs(constants.getLastAuthMethodKey()).returns("apiKey");

      const result = await authService.hasOAuthCredentials();

      expect(result).to.be.false;
    });
  });

  describe("hasStoredOAuthCredentials", () => {
    it("should return true when OAuth credentials exist", () => {
      mockContext.globalState.get.withArgs(constants.getLastOAuthBaseUriKey()).returns("https://api.cx.com");
      mockContext.globalState.get.withArgs(constants.getLastOAuthTenantKey()).returns("tenant");

      const result = authService.hasStoredOAuthCredentials();

      expect(result).to.be.true;
    });

    it("should return false when OAuth credentials missing", () => {
      mockContext.globalState.get.returns(undefined);

      const result = authService.hasStoredOAuthCredentials();

      expect(result).to.be.false;
    });

    it("should not check auth method", () => {
      mockContext.globalState.get.withArgs(constants.getLastOAuthBaseUriKey()).returns("uri");
      mockContext.globalState.get.withArgs(constants.getLastOAuthTenantKey()).returns("tenant");

      const result = authService.hasStoredOAuthCredentials();

      expect(result).to.be.true;
    });
  });

  describe("hasApiKeyCredentials", () => {
    it("should return true when API Key auth method is active", async () => {
      mockContext.secrets.get.resolves("api-key");
      mockContext.globalState.get.withArgs(constants.getLastAuthMethodKey()).returns("apiKey");

      const result = await authService.hasApiKeyCredentials();

      expect(result).to.be.true;
    });

    it("should return false when auth method is oauth", async () => {
      mockContext.secrets.get.resolves("token");
      mockContext.globalState.get.withArgs(constants.getLastAuthMethodKey()).returns("oauth");

      const result = await authService.hasApiKeyCredentials();

      expect(result).to.be.false;
    });

    it("should return false when no token", async () => {
      mockContext.secrets.get.resolves(undefined);

      const result = await authService.hasApiKeyCredentials();

      expect(result).to.be.false;
    });
  });

  describe("clearOAuthCredentials", () => {
    it("should clear baseUri and tenant", async () => {
      await authService.clearOAuthCredentials();

      expect(mockContext.globalState.update.callCount).to.equal(2);
      const calls = mockContext.globalState.update.getCalls();
      expect(calls.some(c => c.args[1] === undefined)).to.be.true;
    });
  });

  describe("validateAndUpdateState", () => {
    it("should set isValidCredentials to false when no token", async () => {
      mockContext.secrets.get.resolves(undefined);

      const result = await authService.validateAndUpdateState();

      expect(result).to.be.false;
      expect((vscode.commands.executeCommand as sinon.SinonStub).called).to.be.true;
    });

    it("should validate token and update context", async () => {
      mockContext.secrets.get.resolves("valid-token");
      const mockCx = {
        authValidate: sandbox.stub().resolves(true),
        isScanEnabled: sandbox.stub().resolves(true),
      };
      sandbox.stub(authService as any, "getCx" as any).returns(mockCx);

      const result = await authService.validateAndUpdateState();

      expect(result).to.be.true;
    });

    it("should handle validation errors gracefully", async () => {
      mockContext.secrets.get.rejects(new Error("Secret error"));

      const result = await authService.validateAndUpdateState();

      expect(result).to.be.false;
    });
  });

  describe("saveToken", () => {
    it("should store token and validate", async () => {
      const mockCx = {
        authValidate: sandbox.stub().resolves(true),
        isScanEnabled: sandbox.stub().resolves(true),
      };
      sandbox.stub(authService as any, "getCx" as any).returns(mockCx);
      sandbox.stub(authService, "validateAndUpdateState").resolves(true);

      await authService.saveToken(mockContext, "new-token");

      expect(mockContext.secrets.store.called).to.be.true;
    });

    it("should execute refresh tree command", async () => {
      const mockCx = {
        authValidate: sandbox.stub().resolves(true),
        isScanEnabled: sandbox.stub().resolves(true),
      };
      sandbox.stub(authService as any, "getCx" as any).returns(mockCx);
      sandbox.stub(authService, "validateAndUpdateState").resolves(true);

      await authService.saveToken(mockContext, "token");

      expect((vscode.commands.executeCommand as any).called).to.be.true;
    });
  });

  describe("logout", () => {
    it("should delete token", async () => {
      sandbox.stub(authService, "validateAndUpdateState").resolves(false);

      await authService.logout();

      expect(mockContext.secrets.delete.called).to.be.true;
    });

    it("should clear standalone state", async () => {
      sandbox.stub(authService, "validateAndUpdateState").resolves(false);

      await authService.logout();

      expect(mockContext.globalState.update.called).to.be.true;
    });

    it("should execute clear commands", async () => {
      sandbox.stub(authService, "validateAndUpdateState").resolves(false);

      await authService.logout();

      expect((vscode.commands.executeCommand as sinon.SinonStub).called).to.be.true;
    });
  });

  describe("tryAutoAuthenticateOAuth", () => {
    it("should return true when valid token and oauth creds exist", async () => {
      mockContext.secrets.get.resolves("valid-token");
      mockContext.globalState.get.withArgs(constants.getLastOAuthBaseUriKey()).returns("uri");
      mockContext.globalState.get.withArgs(constants.getLastOAuthTenantKey()).returns("tenant");
      sandbox.stub(authService, "validateAndUpdateState").resolves(true);

      const result = await authService.tryAutoAuthenticateOAuth();

      expect(result).to.be.true;
    });

    it("should return false when no oauth creds", async () => {
      mockContext.globalState.get.returns(undefined);

      const result = await authService.tryAutoAuthenticateOAuth();

      expect(result).to.be.false;
    });

    it("should return false when validation fails", async () => {
      mockContext.secrets.get.resolves("token");
      mockContext.globalState.get.withArgs(constants.getLastOAuthBaseUriKey()).returns("uri");
      mockContext.globalState.get.withArgs(constants.getLastOAuthTenantKey()).returns("tenant");
      sandbox.stub(authService, "validateAndUpdateState").resolves(false);

      const result = await authService.tryAutoAuthenticateOAuth();

      expect(result).to.be.false;
    });

    it("should handle errors gracefully", async () => {
      mockContext.secrets.get.rejects(new Error("Secret error"));

      const result = await authService.tryAutoAuthenticateOAuth();

      expect(result).to.be.false;
    });
  });

  describe("tryAutoAuthenticateApiKey", () => {
    it("should return true when valid token exists", async () => {
      mockContext.secrets.get.resolves("valid-key");
      sandbox.stub(authService, "validateAndUpdateState").resolves(true);

      const result = await authService.tryAutoAuthenticateApiKey();

      expect(result).to.be.true;
    });

    it("should return false when no token", async () => {
      mockContext.secrets.get.resolves(undefined);

      const result = await authService.tryAutoAuthenticateApiKey();

      expect(result).to.be.false;
    });

    it("should return false when validation fails", async () => {
      mockContext.secrets.get.resolves("token");
      sandbox.stub(authService, "validateAndUpdateState").resolves(false);

      const result = await authService.tryAutoAuthenticateApiKey();

      expect(result).to.be.false;
    });
  });

  describe("generatePKCE (private method)", () => {
    it("should generate valid PKCE pair", () => {
      const pkce = (authService as any).generatePKCE();

      expect(pkce.codeVerifier).to.be.a("string");
      expect(pkce.codeChallenge).to.be.a("string");
      expect(pkce.codeVerifier.length).to.be.greaterThan(0);
      expect(pkce.codeChallenge.length).to.be.greaterThan(0);
    });

    it("should generate different PKCE on each call", () => {
      const pkce1 = (authService as any).generatePKCE();
      const pkce2 = (authService as any).generatePKCE();

      expect(pkce1.codeVerifier).to.not.equal(pkce2.codeVerifier);
      expect(pkce1.codeChallenge).to.not.equal(pkce2.codeChallenge);
    });
  });

  describe("validateConnection (private method)", () => {
    it("should reject invalid URL protocol", async () => {
      const result = await (authService as any).validateConnection("ftp://example.com", "tenant");

      expect(result.isValid).to.be.false;
      expect(result.error).to.include("protocol");
    });

    it("should reject empty tenant name", async () => {
      const result = await (authService as any).validateConnection("https://example.com", "");

      expect(result.isValid).to.be.false;
      expect(result.error).to.include("Tenant");
    });

    it("should reject connection errors", async () => {
      sandbox.stub(authService as any, "checkUrlExists").resolves(false);

      const result = await (authService as any).validateConnection("https://invalid.com", "tenant");

      expect(result.isValid).to.be.false;
    });
  });
});
