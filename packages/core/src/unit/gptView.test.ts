/* eslint-disable @typescript-eslint/no-explicit-any */
import "./mocks/vscode-mock"; // Ensure mock is loaded first
import * as vscode from "vscode";
import { expect } from "chai";
import * as sinon from "sinon";
import { GptView } from "../views/gptView/gptView";
import { GptResult } from "../models/gptResult";
import { constants } from "../utils/common/constants";

describe("GptView", () => {
    let context: vscode.ExtensionContext;
    let extensionUri: vscode.Uri;
    let gptView: GptView;
    let gptResult: GptResult;
    let mockWebview: vscode.Webview;

    beforeEach(() => {
        context = {
            subscriptions: [],
            extensionUri: vscode.Uri.parse("file:///mock"),
            extensionPath: "/mock",
        } as any;

        extensionUri = vscode.Uri.parse("file:///mock");

        // ✅ Fix: Provide valid mock objects for GptResult
        gptResult = new GptResult(
            {
                fileName: "mockFile.js",
                type: "sast",
                id: "mock-result-id",
                severity: "High",
                label: "Mock Label",
                kicsNode: { data: { filename: "mockFile.js", line: 5 } },
            } as any,
            {
                files: [{ file_name: "mockFile.js", line: 5 }],
                severity: "High",
                query_name: "Mock Query",
            } as any
        );

        gptView = new GptView(gptResult, context, false);

        // Mock webview with proper asWebviewUri implementation
        mockWebview = {
            asWebviewUri: (uri: vscode.Uri) => ({
                ...uri,
                toString: () => `mock-uri://${uri.path}`
            }),
            options: {},
            html: "",
            onDidReceiveMessage: sinon.stub(),
            postMessage: sinon.stub(),
        } as any;
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should initialize GptView correctly", () => {
        expect(gptView).to.be.instanceOf(GptView);
        expect(gptView.getLoad()).to.be.false;
        expect(gptView.getResult()).to.deep.equal(gptResult);
    });

    it("should set and get the result", () => {
        const newResult = new GptResult(
            {
                fileName: "newMockFile.js",
                type: "sast",
                id: "new-mock-result-id",
                severity: "Medium",
                label: "New Mock Label",
            } as any,
            {
                files: [{ file_name: "newMockFile.js", line: 10 }],
                severity: "Medium",
                query_name: "New Mock Query",
            } as any
        );

        gptView.setResult(newResult);
        expect(gptView.getResult()).to.equal(newResult);
    });

    it("should set and get loadChanges state", () => {
        gptView.setLoad(true);
        expect(gptView.getLoad()).to.be.true;
    });

    it("should set webview and generate HTML content", async () => {
        const mockWebviewView = {
            webview: mockWebview,
        } as any;

        await gptView.resolveWebviewView(mockWebviewView, {} as any, {} as any);

        expect(mockWebview.options.enableScripts).to.be.true;
        expect(mockWebview.options.localResourceRoots!).to.have.lengthOf(2);
        expect(mockWebview.options.localResourceRoots![0].path).to.include('media');
        expect(mockWebview.options.localResourceRoots![1]).to.exist;
        expect(mockWebview.html).to.be.a("string");
        expect(mockWebview.html).to.include(constants.aiSecurityChampion);
    });

    it("should get AskKicsIcon and KicsUserIcon URIs", async () => {
        const mockWebviewView = {
            webview: mockWebview,
        } as any;

        await gptView.resolveWebviewView(mockWebviewView, {} as any, {} as any);

        const kicsIcon = gptView.getAskKicsIcon();
        const userIcon = gptView.getAskKicsUserIcon();

        expect(kicsIcon).to.not.be.undefined;
        expect(userIcon).to.not.be.undefined;
        expect(kicsIcon.toString()).to.include("kics.png");
        expect(userIcon.toString()).to.include("userKics.png");
    });

    it("should return valid webview instance", () => {
        expect(gptView.getWebView()).to.be.undefined; // Initially undefined
    });

    it("should generate masked secrets section correctly", () => {
        const maskedData = {
            maskedSecrets: [
                { secret: "password123", masked: "******", line: 10 },
            ],
        } as any;

        gptView = new GptView(gptResult, context, false, undefined, maskedData);
        const html = gptView.generateMaskedSection();

        expect(html).to.include("password123");
        expect(html).to.include("******");
        expect(html).to.include("Line: 10");
    });

    it("should return default message if no secrets are masked", () => {
        const html = gptView.generateMaskedSection();
        expect(html).to.include("No secrets were detected and masked");
    });
});
