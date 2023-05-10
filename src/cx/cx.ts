import * as vscode from "vscode";
import { CxWrapper } from "@checkmarxdev/ast-cli-javascript-wrapper";
import CxScaRealtime from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scaRealtime/CxScaRealTime";
import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxProject from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/project/CxProject";
import CxCodeBashing from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/codebashing/CxCodeBashing";
import { CxConfig } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import {
    RESULTS_FILE_EXTENSION,
    RESULTS_FILE_NAME, SCAN_CREATE_ADDITIONAL_PARAMETERS,
} from "../utils/common/constants";
import { getFilePath } from "../utils/utils";
import { SastNode } from "../models/sastNode";
import AstError from "../exceptions/AstError";
import { CxParamType } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxParamType";
import { Logs } from "../models/logs";
import { CxPlatform } from "./cxPlatform";
import { CxCommandOutput } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxCommandOutput";
import { ChildProcessWithoutNullStreams } from "child_process";
import CxLearnMoreDescriptions from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/learnmore/CxLearnMoreDescriptions";
export class Cx implements CxPlatform {
    async scaScanCreate(sourcePath: string): Promise<CxScaRealtime[] | undefined> {
        const cx = new CxWrapper(this.getBaseAstConfiguration());
        let jsonResults = [];
        const scan = await cx.runScaRealtimeScan(sourcePath);
        if (scan.payload && scan.payload.length > 0 && scan.exitCode === 0) {
            if (scan.payload[0].results) {
                jsonResults = scan.payload[0].results;
            }
        } else {
            throw new Error(scan.status);
        }

        return jsonResults;
    }

    async scanCreate(projectName: string, branchName: string, sourcePath: string) {
        const config = this.getAstConfiguration();
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
        params.set(CxParamType.AGENT, "VS Code");
        params.set(CxParamType.ADDITIONAL_PARAMETERS, SCAN_CREATE_ADDITIONAL_PARAMETERS);
        const scan = await cx.scanCreate(params);
        return scan.payload[0];
    }

    async scanCancel(scanId: string) {
        const config = this.getAstConfiguration();
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
        const config = this.getAstConfiguration();
        if (!config) {
            return [];
        }
        if (!scanId) {
            return;
        }
        const cx = new CxWrapper(config);
        await cx.getResults(scanId, RESULTS_FILE_EXTENSION, RESULTS_FILE_NAME, getFilePath());
    }

    async getScan(scanId: string | undefined): Promise<CxScan | undefined> {
        const config = this.getAstConfiguration();
        if (!config) {
            return undefined;
        }
        if (!scanId) {
            return;
        }
        const cx = new CxWrapper(config);
        const scan = await cx.scanShow(scanId);
        return scan.payload[0];
    }

    async getProject(projectId: string | undefined): Promise<CxProject | undefined> {
        const config = this.getAstConfiguration();
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

    async getProjectList(): Promise<CxProject[] | undefined> {
        let r = [];
        const config = this.getAstConfiguration();
        if (!config) {
            return [];
        }
        const cx = new CxWrapper(config);
        const projects = await cx.projectList("limit=10000");

        if (projects.payload) {
            r = projects.payload;
        } else {
            throw new Error(projects.status);
        }
        return r;
    }

    async getBranches(projectId: string | undefined): Promise<string[] | undefined> {
        let r = [];
        const config = this.getAstConfiguration();
        if (!config) {
            return [];
        }
        const cx = new CxWrapper(config);
        let branches = undefined;
        if (projectId) {
            branches = await cx.projectBranches(projectId, "");
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

    async getScans(projectId: string | undefined, branch: string | undefined): Promise<CxScan[] | undefined> {
        let r = [];
        const config = this.getAstConfiguration();
        if (!config) {
            return [];
        }
        const filter = `project-id=${projectId},branch=${branch},limit=10000,statuses=Completed`;
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
        config.additionalParameters = vscode.workspace.getConfiguration("checkmarxOne").get("additionalParams") as string;

        return config;
    }


    getAstConfiguration() {
        const token = vscode.workspace.getConfiguration("checkmarxOne").get("apiKey") as string;
        if (!token) {
            return undefined;
        }

        const config = this.getBaseAstConfiguration();
        config.apiKey = token;
        return config;
    }

    async isScanEnabled(logs: Logs): Promise<boolean> {
        let enabled = false;
        const apiKey = vscode.workspace.getConfiguration("checkmarxOne").get("apiKey") as string;
        if (!apiKey) {
            return enabled;
        }
        const config = new CxConfig();
        config.apiKey = apiKey;
        const cx = new CxWrapper(config);
        try {
            enabled = await cx.ideScansEnabled();
        } catch (error) {
            logs.error(error);
            return enabled;
        }
        return enabled;
    }

    async isSCAScanEnabled(): Promise<boolean> {
        const enabled = true;
        return enabled;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async triageShow(projectId: string, similarityId: string, scanType: string): Promise<any[] | undefined> {
        let r = [];
        const config = this.getAstConfiguration();
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

    async triageUpdate(projectId: string, similarityId: string, scanType: string, state: string, comment: string, severity: string): Promise<number> {
        let r = -1;
        const config = this.getAstConfiguration();
        if (!config) {
            return r;
        }
        const cx = new CxWrapper(config);
        const triage = await cx.triageUpdate(projectId, similarityId, scanType, state, comment, severity.toLowerCase());
        if (triage.exitCode === 0) {
            r = triage.exitCode;
        } else {
            throw new Error(triage.status); //New to return exit code
        }
        return r;
    }

    async getCodeBashing(cweId: string, language: string, queryName: string): Promise<CxCodeBashing | undefined> {
        const config = this.getAstConfiguration();
        if (!config) {
            throw new Error("Configuration error");
        }
        if (!cweId || !language || !queryName) {
            throw new Error("Missing mandatory parameters, cweId, language or queryName ");
        }
        const cx = new CxWrapper(config);
        const codebashing = await cx.codeBashingList(cweId.toString(), language, queryName.replaceAll("_", " "));
        if (codebashing.exitCode === 0) {
            return codebashing.payload[0];
        } else {
            throw new AstError(codebashing.exitCode, codebashing.status);
        }
    }

    async getResultsBfl(scanId: string, queryId: string, resultNodes: SastNode[]) {
        const config = this.getAstConfiguration();
        if (!config) {
            throw new Error("Configuration error");
        }
        if (!scanId || !queryId || !resultNodes) {
            throw new Error("Missing mandatory parameters, scanId, queryId or resultNodes ");
        }
        const cx = new CxWrapper(config);
        const bfl = await cx.getResultsBfl(scanId.toString(), queryId.toString(), resultNodes);
        if (bfl.exitCode === 0) {
            return bfl.payload[0];
        } else {
            throw new Error(bfl.status); //Need to return exit code
        }
    }

    async getResultsRealtime(fileSources: string, additionalParams: string): Promise<[Promise<CxCommandOutput>, ChildProcessWithoutNullStreams]> {

        if (!fileSources) {
            throw new Error("Missing mandatory parameters, fileSources");
        }
        const cx = new CxWrapper(new CxConfig());
        let [kics, process] = [undefined, undefined];
        try {
            [kics, process] = await cx.kicsRealtimeScan(fileSources, "", additionalParams);
        } catch (e) {
            throw new Error("Error running kics scan");
        }
        return [kics, process];

    }

    async scaRemediation(packageFile: string, packages: string, packageVersion: string) {
        const config = this.getAstConfiguration();
        if (!config) {
            throw new Error("Configuration error");
        }
        const cx = new CxWrapper(config);
        const scaFix = await cx.scaRemediation(packageFile, packages, packageVersion);
        if (scaFix.exitCode === 0) {
            return scaFix.exitCode;
        } else {
            throw new Error(scaFix.status.replaceAll("\n", "")); //Need to return exit code
        }
    }

    async kicsRemediation(resultsFile: string, kicsFile: string, engine: string, similarityIds?: string): Promise<[Promise<CxCommandOutput>, ChildProcessWithoutNullStreams]> {

        if (!resultsFile) {
            throw new Error("Missing mandatory parameters, resultsFile");
        }
        if (!kicsFile) {
            throw new Error("Missing mandatory parameters, kicsFile");
        }
        const cx = new CxWrapper(new CxConfig());
        let [kics, process] = [undefined, undefined];
        try {
            [kics, process] = await cx.kicsRemediation(resultsFile, kicsFile, engine, similarityIds);
        } catch (e) {
            throw new Error("Error running kics remediation");
        }
        return [kics, process];

    }

    async learnMore(queryID: string): Promise<CxLearnMoreDescriptions[] | undefined> {
        let r = [];
        const config = this.getAstConfiguration();
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

    updateStatusBarItem(text: string, show: boolean, statusBarItem: vscode.StatusBarItem) {
        statusBarItem.text = text;
        show ? statusBarItem.show() : statusBarItem.hide();
    }
}

