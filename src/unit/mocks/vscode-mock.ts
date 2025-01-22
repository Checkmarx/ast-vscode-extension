import mockRequire from "mock-require";
import { constants } from "../../utils/common/constants";

let commandsExecuted: string[] = [];

const mock = {
  workspace: {
    getConfiguration: (section: string) => {
      if (section === "checkmarxOne") {
        return {
          get: (key: string) => {
            if (key === constants.apiKey) {
              return "valid-api-key";
            }
            if (key === "additionalParams") {
              return "valid-api-key";
            }
            return undefined;
          },
        };
      }
      return undefined;
    },
    workspaceFolders: [{ uri: { fsPath: "/mock/path" } }],
  },

  window: {
    showErrorMessage: () => Promise.resolve(),
    showInformationMessage: () => Promise.resolve(),
    createOutputChannel: () => ({
      append: () => {},
      appendLine: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
      replace: () => {},
      name: "Test"
    })
  },

  commands: {
    executeCommand: (command: string) => {
      commandsExecuted.push(command);
    },
    getCommands: () => Promise.resolve([]),
    registerCommand: (command: string, callback: (...args: any[]) => any) => {
      return { dispose: () => {} };
    }
  },

  ProgressLocation: {
    Notification: "Notification",
  },

  Uri: {
    file: (path: string) => ({ fsPath: path })
  }
};

mockRequire("vscode", mock);

export const getCommandsExecuted = () => commandsExecuted;
export const clearCommandsExecuted = () => { commandsExecuted = []; };

