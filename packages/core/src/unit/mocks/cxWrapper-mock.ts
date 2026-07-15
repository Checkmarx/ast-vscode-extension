import mockRequire from "mock-require";
import { CxParamType } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/wrapper/CxParamType";
import { CxConfig } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";

mockRequire("@checkmarx/ast-cli-javascript-wrapper", {
  CxWrapper: class {
    config: CxConfig;

    constructor(config?: CxConfig) {
      this.config = config || new CxConfig();
    }

    async scanShow(scanId: string) {
      if (scanId === "e3b2505a-0634-4b41-8fa1-dfeb2edc26f9") {
        return {
          exitCode: 0,
          payload: [
            {
              tags: {},
              groups: undefined,
              id: "e3b2505a-0634-4b41-8fa1-dfeb2edc26f9",
              projectID: "2588deba-1751-4afc-b7e3-db71727a1edd",
              status: "Completed",
              createdAt: "2023-04-19T10:07:37.628413+01:00",
              updatedAt: "2023-04-19T09:08:27.151913Z",
              origin: "grpc-java-netty 1.35.0",
              initiator: "tiago",
              branch: "main",
            },
          ],
        };
      } else {
        return {
          status: "Failed showing a scan: scan not found.",
          payload: [],
          exitCode: 1,
        };
      }
    }

    async projectShow(projectId: string) {
      if (projectId === "test-project-id") {
        return {
          payload: [
            {
              id: "test-project-id",
              name: "Test Project",
              createdAt: "2023-04-19T10:07:37.628413+01:00",
              updatedAt: "2023-04-19T09:08:27.151913Z",
              groups: [],
              tags: {},
              criticality: 3
            }
          ],
          exitCode: 0
        };
      } else {
        return {
          status: "Project not found",
          payload: [],
          exitCode: 1
        };
      }
    }

    async scanCreate(params: Map<CxParamType, string>) {
      if (params.get(CxParamType.PROJECT_NAME) === "test-project" &&
        params.get(CxParamType.BRANCH) === "main") {
        return {
          payload: [
            {
              id: "scan-123",
              status: "Created",
              projectId: "test-project-id",
              branch: "main",
              createdAt: "2023-04-19T10:07:37.628413+01:00"
            }
          ],
          exitCode: 0
        };
      } else {
        return {
          status: "Failed to create scan",
          payload: undefined,
          exitCode: 1
        };
      }
    }

    async getResults(scanId: string, fileExtension: string, fileName: string, filePath: string, agent: string) {
      if (scanId === "valid-scan-id") {
        return {
          payload: "Results retrieved successfully",
          exitCode: 0
        };
      } else {
        throw new Error("Failed to get results");
      }
    }

    async authValidate() {
      if (this.config?.apiKey === "valid-api-key") {
        return {
          exitCode: 0,
          status: "Authenticated successfully"
        };
      } else {
        return {
          exitCode: 1,
          status: "Authentication failed"
        };
      }
    }

    async scanCancel(scanId: string) {
      if (scanId === "cancel-scan-id") {
        return { exitCode: 0, status: "Cancelled" };
      }
      return { exitCode: 1, status: "Cancel failed" };
    }

    async projectList(params: string) {
      if (params === "valid") {
        return {
          exitCode: 0,
          payload: [{ id: "proj-1", name: "Project 1" }],
        };
      }
      return { exitCode: 1, status: "Failed to list projects", payload: [] };
    }

    async projectBranches(projectId: string, _params: string) {
      if (projectId === "test-project-id") {
        return { payload: ["main", "develop"], exitCode: 0 };
      }
      return { status: "Branches not found", payload: undefined, exitCode: 1 };
    }

    async scanList(_filter: string) {
      return {
        payload: [
          {
            id: "scan-1",
            status: "Completed",
            branch: "main",
            projectID: "test-project-id",
          },
        ],
        exitCode: 0,
      };
    }

    async ideScansEnabled() {
      return this.config?.apiKey === "valid-api-key";
    }

    async guidedRemediationEnabled() {
      return true;
    }

    async standaloneEnabled() {
      return this.config?.apiKey === "valid-api-key";
    }

    async cxOneAssistEnabled() {
      return true;
    }

    async aiMcpServerEnabled() {
      return this.config?.apiKey === "valid-api-key";
    }

    async mask(_filePath: string) {
      return {
        exitCode: 0,
        payload: [{ masked: true }],
        status: "ok",
      };
    }

    async triageShow(_projectId: string, _similarityId: string, _scanType: string) {
      return { exitCode: 0, payload: [{ state: "ToVerify" }] };
    }

    async triageUpdate(_params: Map<CxParamType, string>) {
      return { exitCode: 0, status: "Updated" };
    }

    async triageGetStates(_all: boolean) {
      return { exitCode: 0, payload: ["ToVerify", "Confirmed"] };
    }

    async codeBashingList(cweId: string, _language: string, _queryName: string) {
      if (cweId) {
        return { exitCode: 0, payload: [{ path: "lesson.html" }] };
      }
      return { exitCode: 1, status: "Not found" };
    }

    async getResultsBfl(_scanId: string, _queryId: string, _nodes: unknown) {
      return { exitCode: 0, payload: [{ bfl: true }] };
    }

    async kicsRealtimeScan(fileSources: string, _a: string, _b: string) {
      if (!fileSources) throw new Error("missing");
      return [Promise.resolve({ exitCode: 0 }), { kill: () => { } }];
    }

    async scaRemediation(_packageFile: string, _packages: string, _version: string) {
      return { exitCode: 0, status: "ok" };
    }

    async kicsRemediation(resultsFile: string, kicsFile: string, _engine: string, _ids?: string) {
      if (!resultsFile || !kicsFile) throw new Error("missing");
      return [Promise.resolve({ exitCode: 0 }), { kill: () => { } }];
    }

    async learnMore(queryId: string) {
      if (queryId) {
        return { exitCode: 0, payload: [{ description: "info" }] };
      }
      return { exitCode: 1, status: "failed" };
    }

    async scanAsca(_source: unknown, _install: boolean, _ignore: unknown) {
      return { exitCode: 0, payload: [{ installed: true }] };
    }

    async containersRealtimeScanResults(_source: string, _ignore?: string) {
      return { exitCode: 0, payload: [[]] };
    }

    async ossScanResults(_source: string, _ignore?: string) {
      return { exitCode: 0, payload: [[]] };
    }

    async iacRealtimeScanResults(_source: string, _tool: string, _ignore?: string) {
      return { exitCode: 0, payload: [[]] };
    }

    async secretsScanResults(_source: string, _ignore?: string) {
      return { exitCode: 0, payload: [[]] };
    }

    async riskManagementResults(_projectId: string, _scanId: string) {
      return { exitCode: 0, payload: {} };
    }

    async telemetry(_event: string, _sub: string, _engine: string, _severity: string) {
      return { exitCode: 0 };
    }

    async detectionTelemetry(_scanType: string, _status: string, _count: number) {
      return { exitCode: 0 };
    }
  },
});