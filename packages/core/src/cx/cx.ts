import * as vscode from "vscode";
import { CxWrapper } from "@checkmarx/ast-cli-javascript-wrapper";
import CxScaRealtime from "@checkmarx/ast-cli-javascript-wrapper/dist/main/scaRealtime/CxScaRealTime";
import CxScan from "@checkmarx/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxProject from "@checkmarx/ast-cli-javascript-wrapper/dist/main/project/CxProject";
import CxCodeBashing from "@checkmarx/ast-cli-javascript-wrapper/dist/main/codebashing/CxCodeBashing";
import { CxConfig } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import { constants } from "../utils/common/constants";
import { getFilePath, getResultsFilePath, isIDE } from "../utils/utils";
import { SastNode } from "../models/sastNode";
import AstError from "../exceptions/AstError";
import { CxParamType } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/wrapper/CxParamType";
import { Logs } from "../models/logs";
import { CxPlatform } from "./cxPlatform";
import { CxCommandOutput } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/wrapper/CxCommandOutput";
import { ChildProcessWithoutNullStreams } from "child_process";
import CxLearnMoreDescriptions
    from "@checkmarx/ast-cli-javascript-wrapper/dist/main/learnmore/CxLearnMoreDescriptions";
import CxAsca from "@checkmarx/ast-cli-javascript-wrapper/dist/main/asca/CxAsca";
import { AuthService } from "../services/authService";
import CxOssResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/oss/CxOss";
import CxSecretsResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/secrets/CxSecrets";
import { getMessages } from "../config/extensionMessages";

export class Cx implements CxPlatform {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async scaScanCreate(sourcePath: string): Promise<CxScaRealtime | undefined> {
        const cx = new CxWrapper(this.getBaseAstConfiguration());
        let jsonResults = undefined;
        const scan = await cx.runScaRealtimeScan(sourcePath);
        if (scan.payload && scan.payload.length > 0 && scan.exitCode === 0) {
            if (scan.payload[0].results) {
                jsonResults = scan.payload[0];
            }
        } else {
            throw new Error(scan.status);
        }
        return jsonResults;
    }

    async runSastGpt(
        message: string,
        filePath: string,
        resultId: string,
        conversationId?: string
    ) {
        const resultsFilePath = getResultsFilePath();
        const cx = new CxWrapper(await this.getAstConfiguration());
        const { gptToken, gptEngine } = this.getGptConfig();

        this.validateWorkspaceFolders();

        const answer = await cx.sastChat(
            gptToken,
            filePath,
            resultsFilePath,
            resultId,
            message,
            conversationId ? conversationId : "",
            gptEngine
        );
        if (answer.payload && answer.exitCode === 0) {
            return answer.payload;
        } else {
            throw new Error(answer.status);
        }
    }

    async runGpt(
        message: string,
        filePath: string,
        line: number,
        severity: string,
        queryName: string
    ) {
        const cx = new CxWrapper(await this.getAstConfiguration());
        const { gptToken, gptEngine } = this.getGptConfig();

        this.validateWorkspaceFolders();

        const answer = await cx.kicsChat(
            gptToken,
            filePath,
            line,
            severity,
            queryName,
            message,
            null,
            gptEngine
        );
        if (answer.payload && answer.exitCode === 0) {
            return answer.payload;
        } else {
            throw new Error(answer.status);
        }
    }

    private validateWorkspaceFolders() {
        const filePackageObjectList = vscode.workspace.workspaceFolders;

        if (!filePackageObjectList || filePackageObjectList.length <= 0) {
            throw new Error(constants.gptFileNotInWorkspaceError);
        }
    }

    getGptConfig(): { gptToken: string; gptEngine: string } {
        const config = vscode.workspace.getConfiguration(constants.gptCommandName);

        const gptToken = config.get<string>(constants.gptSettingsKey) || '';
        const selectedModel = config.get<string>(constants.gptEngineKey) || '';
        const customModel = config.get<string>(constants.gptCustomModelKey) || '';

        const gptEngine = customModel.trim() !== '' ? customModel.trim() : selectedModel;

        return { gptToken, gptEngine };
    }

    async mask(filePath: string) {
        const cx = new CxWrapper(this.getBaseAstConfiguration());
        const workspacePath = vscode.workspace.workspaceFolders;
        let masked;
        if (workspacePath && workspacePath.length > 0) {
            masked = await cx.maskSecrets(filePath);
            if (masked.exitCode !== 0) {
                throw new Error(masked.status);
            }
        } else {
            throw new Error("Please open " + filePath + " in the workspace");
        }
        return masked.payload[0];
    }

    async scanCreate(
        projectName: string,
        branchName: string,
        sourcePath: string
    ) {
        const config = await this.getAstConfiguration();
        if (!config) {
            return [];
        }
        if (!projectName) {
            return;
        }
        if (!branchName) {
            return;
        }
        const cx = new CxWrapper(config);
        const params = new Map<CxParamType, string>();
        params.set(CxParamType.S, sourcePath);
        params.set(CxParamType.BRANCH, branchName);
        params.set(CxParamType.PROJECT_NAME, projectName);
        params.set(
            CxParamType.ADDITIONAL_PARAMETERS,
            constants.scanCreateAdditionalParameters
        );
        const scan = await cx.scanCreate(params);

        if (scan.payload && scan.exitCode === 0) {
            return scan.payload[0];
        }
        throw new AstError(scan.exitCode, scan.status);
    }

    async scanCancel(scanId: string) {
        const config = await this.getAstConfiguration();
        if (!config) {
            return [];
        }
        if (!scanId) {
            return;
        }
        const cx = new CxWrapper(config);
        const scan = await cx.scanCancel(scanId);
        return scan.exitCode === 0;
    }

    async getResults(scanId: string | undefined) {
        const config = await this.getAstConfiguration();
        if (!config) {
            return [];
        }
        if (!scanId) {
            return;
        }
        const cx = new CxWrapper(config);
        await cx.getResults(
            scanId,
            constants.resultsFileExtension,
            constants.resultsFileName,
            getFilePath()
        );
    }

    async getScan(scanId: string | undefined): Promise<CxScan | undefined> {
        const config = await this.getAstConfiguration();
        if (!config) {
            return undefined;
        }
        if (!scanId) {
            return;
        }
        const cx = new CxWrapper(config);
        const scan = await cx.scanShow(scanId);
        if (scan.payload && scan.payload.length > 0 && scan.exitCode === 0) {
            return scan.payload[0];
        } else {
            vscode.window.showErrorMessage(scan.status);
            return;
        }
    }

    async getProject(
        projectId: string | undefined
    ): Promise<CxProject | undefined> {
        const config = await this.getAstConfiguration();
        if (!config) {
            return undefined;
        }
        if (!projectId) {
            return;
        }
        const cx = new CxWrapper(config);
        const project = await cx.projectShow(projectId);
        return project.payload[0];
    }

    async getProjectListWithParams(
        params: string
    ): Promise<CxProject[] | undefined> {
        let r = [];
        const config = await this.getAstConfiguration();
        if (!config) {
            return [];
        }
        const cx = new CxWrapper(config);
        const projects = await cx.projectList(params ?? "");

        if (projects.exitCode === 0) {
            r = projects.payload ?? [];
        } else {
            throw new Error(projects.status);
        }
        return r;
    }

    async getBranchesWithParams(
        projectId: string | undefined,
        params?: string | undefined
    ): Promise<string[] | undefined> {
        let r = [];
        const config = await this.getAstConfiguration();
        if (!config) {
            return [];
        }
        const cx = new CxWrapper(config);
        let branches = undefined;
        if (projectId) {
            branches = await cx.projectBranches(projectId, params ?? "");
        } else {
            throw new Error("Project ID is not defined while trying to get branches");
        }
        if (branches.payload) {
            r = branches.payload;
        } else {
            throw new Error(branches.status);
        }
        return r;
    }

    async getScans(
        projectId: string | undefined,
        branch: string | undefined,
        limit = 10000,
        statuses = "Completed"
    ): Promise<CxScan[] | undefined> {
        let r = [];
        const config = await this.getAstConfiguration();
        if (!config) {
            return [];
        }
        const filter = `project-id=${projectId},${branch ? `branch=${branch},` : ""
            }limit=${limit},statuses=${statuses}`;
        const cx = new CxWrapper(config);
        const scans = await cx.scanList(filter);
        if (scans.payload) {
            r = scans.payload;
        } else {
            throw new Error(scans.status);
        }
        return r;
    }

    getBaseAstConfiguration() {
        const config = new CxConfig();
        config.additionalParameters = vscode.workspace
            .getConfiguration("checkmarxOne")
            .get("additionalParams") as string;

        config.agentName = isIDE(constants.kiroAgent) ? constants.kiroAgent : isIDE(constants.cursorAgent) ? constants.cursorAgent : isIDE(constants.windsurfAgent) ? constants.windsurfAgent : constants.vsCodeAgent;
        return config;
    }

    async getAstConfiguration() {
        const token = await this.context.secrets.get(constants.getAuthCredentialSecretKey());

        if (!token) {
            return undefined;
        }

        const config = this.getBaseAstConfiguration();
        config.apiKey = token;
        return config;
    }

    async isValidConfiguration(): Promise<boolean> {
        const token = await this.context.secrets.get(constants.getAuthCredentialSecretKey());

        if (!token) {
            return false;
        }
        const isValidToken = await AuthService.getInstance(
            this.context
        ).validateApiKey(token);
        if (!isValidToken) {
            return false;
        }
        const config = this.getBaseAstConfiguration();
        config.apiKey = token;
        return true;
    }

    async isScanEnabled(logs: Logs): Promise<boolean> {
        let enabled = false;
        const token = await this.context.secrets.get(constants.getAuthCredentialSecretKey());
        if (!token) {
            return enabled;
        }
        const config = await this.getAstConfiguration();
        if (!config) {
            return enabled;
        }
        config.apiKey = token;
        const cx = new CxWrapper(config);
        try {
            enabled = await cx.ideScansEnabled();
        } catch (error) {
            const errMsg = `Error checking tenant configuration: ${error}`;
            logs.error(errMsg);
            return enabled;
        }
        return enabled;
    }

    async isAIGuidedRemediationEnabled(logs: Logs): Promise<boolean> {
        let enabled = true;
        const token = await this.context.secrets.get(constants.getAuthCredentialSecretKey());
        if (!token) {
            return enabled;
        }
        const config = await this.getAstConfiguration();
        if (!config) {
            return enabled;
        }
        config.apiKey = token;
        const cx = new CxWrapper(config);
        try {
            enabled = await cx.guidedRemediationEnabled();
        } catch (error) {
            logs.error(error);
            return false;
        }
        return enabled;
    }

    async isStandaloneEnabled(logs: Logs): Promise<boolean> {
        return this.getCachedFeatureEnabled(
            constants.getStandaloneEnabledGlobalState(),
            logs,
            async (cx: CxWrapper) => cx.standaloneEnabled(),
            "tenant configuration"
        );
    }


    async isCxOneAssistEnabled(logs: Logs): Promise<boolean> {
        return this.getCachedFeatureEnabled(
            constants.getCxOneAssistEnabledGlobalState(),
            logs,
            async (cx: CxWrapper) => {
                const anyCx = cx as unknown as { cxOneAssistEnabled?: () => Promise<boolean> };
                return anyCx.cxOneAssistEnabled ? await anyCx.cxOneAssistEnabled() : false;
            },
            "tenant configuration (Checkmarx One Assist)"
        );
    }

    async refreshStandaloneEnabled(logs: Logs): Promise<boolean> {
        await this.context.globalState.update(constants.getStandaloneEnabledGlobalState(), undefined);
        return this.isStandaloneEnabled(logs);
    }

    clearStandaloneEnabledCache(): void {
        this.context.globalState.update(constants.getStandaloneEnabledGlobalState(), undefined);
    }

    private async setStandaloneFlag(value: boolean): Promise<void> {
        await this.context.globalState.update(constants.getStandaloneEnabledGlobalState(), value);
    }

    private async clearStandaloneFlag(): Promise<void> {
        await this.context.globalState.update(constants.getStandaloneEnabledGlobalState(), undefined);
    }

    private async getCachedFeatureEnabled(
        globalStateKey: string,
        logs: Logs,
        remoteCheck: (cx: CxWrapper) => Promise<boolean>,
        errorContext: string
    ): Promise<boolean> {
        const token = await this.context.secrets.get(constants.getAuthCredentialSecretKey());
        if (!token) {
            await this.context.globalState.update(globalStateKey, undefined);
            return false;
        }

        const cached = this.context.globalState.get<boolean>(globalStateKey);
        if (cached !== undefined) {
            return cached;
        }

        const config = await this.getAstConfiguration();
        if (!config) {
            await this.context.globalState.update(globalStateKey, false);
            return false;
        }

        const cx = new CxWrapper(config);
        try {
            const enabled = await remoteCheck(cx);
            if (globalStateKey === constants.getStandaloneEnabledGlobalState()) {
                await this.setStandaloneFlag(enabled);
            } else {
                await this.context.globalState.update(globalStateKey, enabled);
            }
            return enabled;
        } catch (error) {
            logs.error(`Error checking ${errorContext}: ${error}`);
            if (globalStateKey === constants.getStandaloneEnabledGlobalState()) {
                await this.setStandaloneFlag(false);
            } else {
                await this.context.globalState.update(globalStateKey, false);
            }
            return false;
        }
    }

    async isAiMcpServerEnabled(): Promise<boolean> {
        let enabled = false;
        const token = await this.context.secrets.get(constants.getAuthCredentialSecretKey());

        if (!token) {
            return enabled;
        }

        const config = await this.getAstConfiguration();
        if (!config) {
            return enabled;
        }

        config.apiKey = token;
        const cx = new CxWrapper(config);

        try {
            enabled = await cx.aiMcpServerEnabled();
        } catch (error) {
            console.error(`Error checking AI MCP server status: ${error}`);
            return enabled;
        }

        return enabled;
    }

    async isSCAScanEnabled(): Promise<boolean> {
        const enabled = true;
        return enabled;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async triageShow(
        projectId: string,
        similarityId: string,
        scanType: string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any[] | undefined> {
        let r = [];
        const config = await this.getAstConfiguration();
        if (!config) {
            return [];
        }
        const cx = new CxWrapper(config);
        const scans = await cx.triageShow(projectId, similarityId, scanType);
        if (scans.payload && scans.exitCode === 0) {
            r = scans.payload;
        } else {
            throw new Error(scans.status);
        }
        return r;
    }

    async triageSCAShow(
        projectId: string,
        vulnerabilities: string,
        scanType: string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any[] | undefined> {
        let r = [];
        const config = await this.getAstConfiguration();
        if (!config) {
            return [];
        }
        const cx = new CxWrapper(config);
        const scans = await cx.triageSCAShow(projectId, vulnerabilities, scanType);
        if (scans.payload && scans.exitCode === 0) {
            r = scans.payload;
        } else {
            throw new Error(scans.status);
        }
        return r;
    }

    async triageSCAUpdate(
        projectId: string,
        similarityId: string,
        scanType: string,
        state: string,
        comment: string
    ): Promise<number> {
        let r = -1;
        const config = await this.getAstConfiguration();
        if (!config) {
            return r;
        }
        const cx = new CxWrapper(config);
        const triage = await cx.triageSCAUpdate(
            projectId,
            similarityId,
            scanType,
            state,
            comment
        );
        if (triage.exitCode === 0) {
            r = triage.exitCode;
        } else {
            throw new Error(triage.status);
        }
        return r;
    }


    async triageUpdate(
        projectId: string,
        similarityId: string,
        scanType: string,
        state: string,
        comment: string,
        severity: string,
        stateId: number
    ): Promise<number> {
        let r = -1;
        const config = await this.getAstConfiguration();
        if (!config) {
            return r;
        }
        const cx = new CxWrapper(config);
        const triage = await cx.triageUpdate(
            projectId,
            similarityId,
            scanType,
            state,
            comment,
            severity.toLowerCase(),
            stateId
        );
        if (triage.exitCode === 0) {
            r = triage.exitCode;
        } else {
            throw new Error(triage.status); //New to return exit code
        }
        return r;
    }

    async triageGetStates(all: boolean): Promise<CxCommandOutput> {
        const config = await this.getAstConfiguration();
        const cx = new CxWrapper(config);
        const states = await cx.triageGetStates(all);
        if (states.exitCode === 0) {
            return states;
        }
    }

    async getCodeBashing(
        cweId: string,
        language: string,
        queryName: string
    ): Promise<CxCodeBashing | undefined> {
        const config = await this.getAstConfiguration();
        if (!config) {
            throw new Error("Configuration error");
        }
        if (!cweId || !language || !queryName) {
            throw new Error(
                "Missing mandatory parameters, cweId, language or queryName "
            );
        }
        const cx = new CxWrapper(config);
        const codebashing = await cx.codeBashingList(
            cweId.toString(),
            language,
            queryName.replaceAll("_", " ")
        );
        if (codebashing.exitCode === 0) {
            return codebashing.payload[0];
        } else {
            throw new AstError(codebashing.exitCode, codebashing.status);
        }
    }

    async getResultsBfl(
        scanId: string,
        queryId: string,
        resultNodes: SastNode[]
    ) {
        const config = await this.getAstConfiguration();
        if (!config) {
            throw new Error("Configuration error");
        }
        if (!scanId || !queryId || !resultNodes) {
            throw new Error(
                "Missing mandatory parameters, scanId, queryId or resultNodes "
            );
        }
        const cx = new CxWrapper(config);
        const bfl = await cx.getResultsBfl(
            scanId.toString(),
            queryId.toString(),
            resultNodes
        );
        if (bfl.exitCode === 0) {
            return bfl.payload[0];
        } else {
            throw new Error(bfl.status); //Need to return exit code
        }
    }

    async getResultsRealtime(
        fileSources: string,
        additionalParams: string
    ): Promise<[Promise<CxCommandOutput>, ChildProcessWithoutNullStreams]> {
        if (!fileSources) {
            throw new Error("Missing mandatory parameters, fileSources");
        }
        const cx = new CxWrapper(new CxConfig());
        let [kics, process] = [undefined, undefined];
        try {
            [kics, process] = await cx.kicsRealtimeScan(
                fileSources,
                "",
                additionalParams
            );
        } catch (e) {
            throw new Error("Error running kics scan");
        }
        return [kics, process];
    }

    async scaRemediation(
        packageFile: string,
        packages: string,
        packageVersion: string
    ) {
        const config = await this.getAstConfiguration();
        if (!config) {
            throw new Error("Configuration error");
        }
        const cx = new CxWrapper(config);
        const scaFix = await cx.scaRemediation(
            packageFile,
            packages,
            packageVersion
        );
        if (scaFix.exitCode === 0) {
            return scaFix.exitCode;
        } else {
            throw new Error(scaFix.status.replaceAll("\n", "")); //Need to return exit code
        }
    }

    async kicsRemediation(
        resultsFile: string,
        kicsFile: string,
        engine: string,
        similarityIds?: string
    ): Promise<[Promise<CxCommandOutput>, ChildProcessWithoutNullStreams]> {
        if (!resultsFile) {
            throw new Error("Missing mandatory parameters, resultsFile");
        }
        if (!kicsFile) {
            throw new Error("Missing mandatory parameters, kicsFile");
        }
        const cx = new CxWrapper(new CxConfig());
        let [kics, process] = [undefined, undefined];
        try {
            [kics, process] = await cx.kicsRemediation(
                resultsFile,
                kicsFile,
                engine,
                similarityIds
            );
        } catch (e) {
            throw new Error("Error running kics remediation");
        }
        return [kics, process];
    }

    async learnMore(
        queryID: string
    ): Promise<CxLearnMoreDescriptions[] | undefined> {
        let r = [];
        const config = await this.getAstConfiguration();
        if (!config) {
            return [];
        }
        const cx = new CxWrapper(config);
        const scans = await cx.learnMore(queryID);
        if (scans.payload && scans.exitCode === 0) {
            r = scans.payload;
        } else {
            throw new Error(scans.status);
        }
        return r;
    }

    updateStatusBarItem(
        text: string,
        show: boolean,
        statusBarItem: vscode.StatusBarItem
    ) {
        statusBarItem.text = text;
        show ? statusBarItem.show() : statusBarItem.hide();
    }

    async installAsca(): Promise<CxAsca> {
        let config = await this.getAstConfiguration();
        if (!config) {
            config = new CxConfig();
        }
        const cx = new CxWrapper(config);
        const scans = await cx.scanAsca(null, true, null);
        if (scans.payload && scans.exitCode === 0) {
            return scans.payload[0];
        } else {
            return this.getAscaError(scans.status, "Failed to run ASCA engine");
        }
    }

    private getAscaError(scanStatus: string, errorMessage: string) {
        console.error(errorMessage);
        const errorRes = new CxAsca();
        errorRes.error = scanStatus;
        return errorRes;
    }

    async scanAsca(sourcePath: string, ignorePath: string): Promise<CxAsca> {
        let config = await this.getAstConfiguration();
        if (!config) {
            config = new CxConfig();
        }
        const cx = new CxWrapper(config);
        const scans = await cx.scanAsca(sourcePath, false, ignorePath);
        if (scans.payload && scans.exitCode === 0) {
            return scans.payload[0];
        } else {
            return this.getAscaError(scans.status, "Fail to call ASCA scan");
        }
    }

    async scanContainers(sourcePath: string, ignoredFilePath?: string): Promise<CxOssResult[]> {
        let config = await this.getAstConfiguration();
        if (!config) {
            config = new CxConfig();
        }
        const cx = new CxWrapper(config);

        const scans = await cx.containersRealtimeScanResults(sourcePath, ignoredFilePath);
        if (scans.payload && scans.exitCode === 0) {
            return scans.payload[0];
        } else {
            throw new Error(scans.status);
        }
    }

    async ossScanResults(sourcePath: string, ignoredFilePath?: string): Promise<CxOssResult[]> {
        let config = await this.getAstConfiguration();
        if (!config) {
            config = new CxConfig();
        }

        const cx = new CxWrapper(config);
        const scans = await cx.ossScanResults(sourcePath, ignoredFilePath);

        if (scans.payload && scans.exitCode === 0) {
            return scans.payload[0];
        } else {
            throw new Error(scans.status);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async iacScanResults(sourcePath: string, containersManagementTool: string, ignoredFilePath?: string): Promise<any[]> {
        let config = await this.getAstConfiguration();
        if (!config) {
            config = new CxConfig();
        }

        const cx = new CxWrapper(config);
        const scans = await cx.iacRealtimeScanResults(sourcePath, containersManagementTool, ignoredFilePath);

        if (scans.payload && scans.exitCode === 0) {
            return scans.payload[0];
        } else {
            throw new Error(scans.status);
        }
    }

    async secretsScanResults(sourcePath: string, ignoredFilePath?: string): Promise<CxSecretsResult[]> {
        let config = await this.getAstConfiguration();
        if (!config) {
            config = new CxConfig();
        }

        const cx = new CxWrapper(config);
        const scans = await cx.secretsScanResults(sourcePath, ignoredFilePath);

        if (scans.payload && scans.exitCode === 0) {
            return scans.payload[0];
        } else {
            throw new Error(scans.status);
        }
    }

    async authValidate(logs?: Logs): Promise<boolean> {
        const authFailedMsg = getMessages().authFailedMessage;
        const config = await this.getAstConfiguration();
        const cx = new CxWrapper(config);
        try {
            const valid = await cx.authValidate();
            if (valid.exitCode === 0) {
                return true;
            } else {
                logs?.error(`${authFailedMsg}: ${valid.status}`);
                vscode.window.showErrorMessage(authFailedMsg);
                return false;
            }
        } catch (error) {
            logs?.error(`${authFailedMsg}: ${error}`);
            vscode.window.showErrorMessage(authFailedMsg);
            return false;
        }
    }

    async getRiskManagementResults(
        projectId: string,
        scanId: string
    ): Promise<object | undefined> {
        const config = await this.getAstConfiguration();
        const cx = new CxWrapper(config);
        const applications = await cx.riskManagementResults(projectId, scanId);
        let r = [];
        if (applications.payload) {
            r = applications.payload;
        } else {
            throw new Error(applications.status);
        }

        return r;
    }

    async setUserEventDataForLogs(eventType: string, subType: string, engine: string, problemSeverity: string) {
        const config = await this.getAstConfiguration();
        const cx = new CxWrapper(config);
        const aiProvider = isIDE(constants.kiroAgent) ? constants.kiroAgent : isIDE(constants.cursorAgent) ? constants.cursorAgent : isIDE(constants.windsurfAgent) ? "Cascade" : "Copilot";
        cx.telemetryAIEvent(aiProvider, eventType, subType, engine, problemSeverity, "", "", 0);
    }

    async setUserEventDataForDetectionLogs(scanType: string, status: string, totalCount: number) {
        const config = await this.getAstConfiguration();
        const cx = new CxWrapper(config);
        if (totalCount > 0) {
            cx.telemetryAIEvent("", "", "", "", "",
                scanType, status, totalCount);
        }
    }

    async sendAIFixOutcomeTelemetry(
        eventType: string,
        scannerType: string,
        severity: string,
        mcpSuggestedVersion?: string,
        actualVersion?: string,
        retryCount?: number,
        additionalData?: string
    ): Promise<void> {
        try {
            const config = await this.getAstConfiguration();
            if (!config) {
                console.warn("Cannot send AI fix telemetry: no configuration");
                return;
            }

            const cxWrapper = new CxWrapper(config);
            const aiProvider = isIDE(constants.kiroAgent)
                ? constants.kiroAgent
                : isIDE(constants.cursorAgent)
                    ? constants.cursorAgent
                    : isIDE(constants.windsurfAgent)
                        ? "Cascade"
                        : "Copilot";
            const agent = isIDE(constants.kiroAgent)
                ? constants.kiroAgent
                : isIDE(constants.cursorAgent)
                    ? constants.cursorAgent
                    : isIDE(constants.windsurfAgent)
                        ? constants.windsurfAgent
                        : constants.vsCodeAgent;

            // Build subType with fix outcome details
            const subTypeData = {
                mcpSuggestedVersion,
                actualVersion,
                retryCount,
                ...(additionalData ? JSON.parse(additionalData) : {})
            };

            cxWrapper.telemetryAIEvent(
                aiProvider,
                "click",
                eventType,
                scannerType,
                severity,
                "",
                "",
                0
            );
        } catch (error) {
            console.error(`Failed to send AI fix outcome telemetry: ${error}`);
        }
    }
}
