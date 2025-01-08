import mockRequire from "mock-require";

mockRequire("vscode", {
  workspace: {
    getConfiguration: (section: string) => {
      if (section === "checkmarxOne") {
        return {
          get: (key: string) => {
            if (key === "apiKey") {
              return "apiKey";
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
