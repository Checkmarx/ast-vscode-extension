import mockRequire from "mock-require";
import { constants } from "../../utils/common/constants";

mockRequire("vscode", {
  workspace: {
    getConfiguration: (section: string) => {
      if (section === "checkmarxOne") {
        return {
          get: (key: string) => {
            if (key === constants.apiKey) {
              return constants.apiKey;
            }
            return undefined;
          },
        };
      }
      return undefined;
    },
    workspaceFolders: [{ uri: { fsPath: "/mock/path" } }],
  },

  ProgressLocation: {
    Notification: "Notification",
  },
});
