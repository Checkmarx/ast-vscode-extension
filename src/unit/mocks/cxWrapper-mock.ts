import mockRequire from "mock-require";
mockRequire("@checkmarxdev/ast-cli-javascript-wrapper", {
  CxWrapper: class {
    async scanShow(scanId: string) {
      if (scanId === "1") {
        return {
          payload: [
            {
              tags: {},
              groups: undefined,
              id: "1",
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
          status: "Scan not found",
          payload: [],
        };
      }
    }
  },
});
