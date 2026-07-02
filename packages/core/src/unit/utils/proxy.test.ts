import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import axios from "axios";
import { ProxyHelper } from "../../utils/proxy/proxy";

describe("ProxyHelper", () => {
  let sandbox: sinon.SinonSandbox;
  const originalHttpsProxy = process.env.HTTPS_PROXY;
  const originalHttpProxy = process.env.HTTP_PROXY;

  afterEach(() => {
    sandbox.restore();
    if (originalHttpsProxy === undefined) {
      delete process.env.HTTPS_PROXY;
    } else {
      process.env.HTTPS_PROXY = originalHttpsProxy;
    }
    if (originalHttpProxy === undefined) {
      delete process.env.HTTP_PROXY;
    } else {
      process.env.HTTP_PROXY = originalHttpProxy;
    }
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    delete process.env.HTTPS_PROXY;
    delete process.env.HTTP_PROXY;
  });

  it("should read proxy from additional params", () => {
    sandbox.stub(vscode.workspace, "getConfiguration").returns({
      get: sandbox.stub((key: string) => {
        if (key === "checkmarxOne.additionalParams") {
          return "--proxy http://proxy.local:8080 --proxy-auth-type ntlm --proxy-ntlm-domain CORP";
        }
        return undefined;
      }),
    } as any);

    const helper = new ProxyHelper();
    const config = helper.getProxyConfig();
    expect(config.proxy).to.equal("http://proxy.local:8080");
    expect(config.proxyAuthType).to.equal("ntlm");
    expect(config.proxyNtlmDomain).to.equal("CORP");
  });

  it("should fall back to vscode http.proxy setting", () => {
    sandbox.stub(vscode.workspace, "getConfiguration").returns({
      get: sandbox.stub((key: string) => {
        if (key === "checkmarxOne.additionalParams") return "";
        if (key === "http.proxy") return "http://vscode-proxy:3128";
        if (key === "http.proxyStrictSSL") return true;
        return undefined;
      }),
    } as any);

    const helper = new ProxyHelper();
    const config = helper.getProxyConfig();
    expect(config.proxy).to.equal("http://vscode-proxy:3128");
    expect(config.strictSSL).to.be.true;
  });

  it("should fall back to environment proxy", () => {
    process.env.HTTPS_PROXY = "http://env-proxy:8888";
    sandbox.stub(vscode.workspace, "getConfiguration").returns({
      get: sandbox.stub().returns(""),
    } as any);

    const helper = new ProxyHelper();
    expect(helper.getProxyConfig().proxy).to.equal("http://env-proxy:8888");
  });

  it("should return undefined agent when no proxy configured", () => {
    sandbox.stub(vscode.workspace, "getConfiguration").returns({
      get: sandbox.stub().returns(""),
    } as any);
    const helper = new ProxyHelper();
    expect(helper.createHttpsProxyAgent()).to.be.undefined;
  });

  it("should create agent when proxy is configured", () => {
    sandbox.stub(vscode.workspace, "getConfiguration").returns({
      get: sandbox.stub((key: string) => {
        if (key === "checkmarxOne.additionalParams") return "--proxy http://proxy:8080";
        return "";
      }),
    } as any);
    const helper = new ProxyHelper();
    expect(helper.createHttpsProxyAgent()).to.exist;
  });

  it("should return true for reachability when no proxy is set", async () => {
    sandbox.stub(vscode.workspace, "getConfiguration").returns({
      get: sandbox.stub().returns(""),
    } as any);
    const helper = new ProxyHelper();
    expect(await helper.checkProxyReachability("https://example.com")).to.be.true;
  });

  it("should return true when proxied request returns a status", async () => {
    sandbox.stub(vscode.workspace, "getConfiguration").returns({
      get: sandbox.stub((key: string) => {
        if (key === "checkmarxOne.additionalParams") return "--proxy http://proxy:8080";
        return "";
      }),
    } as any);
    sandbox.stub(axios, "get").resolves({ status: 200 });
    const helper = new ProxyHelper();
    expect(await helper.checkProxyReachability("https://example.com")).to.be.true;
  });

  it("should return false when proxied request fails", async () => {
    sandbox.stub(vscode.workspace, "getConfiguration").returns({
      get: sandbox.stub((key: string) => {
        if (key === "checkmarxOne.additionalParams") return "--proxy http://proxy:8080";
        return "";
      }),
    } as any);
    sandbox.stub(axios, "get").rejects(new Error("network error"));
    const helper = new ProxyHelper();
    expect(await helper.checkProxyReachability("https://example.com")).to.be.false;
  });
});
