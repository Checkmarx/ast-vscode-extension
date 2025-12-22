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
  },
});