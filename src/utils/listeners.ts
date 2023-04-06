import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { RepositoryState } from "../types/git";
import { REFRESH_TREE } from "./common/commands";
import {
  BRANCH_ID_KEY,
  BRANCH_LABEL,
  BRANCH_NAME,
  BRANCH_TEMP_ID_KEY,
  EXTENSION_NAME,
  KICS_REALTIME_FILE,
  PROJECT_ID_KEY,
  SCAN_CREATE_ID_KEY,
  SCAN_CREATE_PREP_KEY,
  SCAN_ID_KEY,
  SCAN_LABEL,
} from "./common/constants";
import { get, update } from "./common/globalState";
import { getBranches } from "./ast/ast";
import { getGitAPIRepository, isKicsFile, isSystemFile } from "./utils";
import { AstResultsProvider } from "../resultsView/ast_results_provider";

export async function getBranchListener(
  context: vscode.ExtensionContext,
  logs: Logs
) {
  const gitApi = await getGitAPIRepository();
  const state = gitApi.repositories[0]?.state;
  if (state) {
    return addRepositoryListener(context, logs, state);
  } else {
    return gitApi.onDidOpenRepository(async () => {
      logs.info("GIT API - Open repository");
      const repoState = gitApi.repositories[0].state;
      return addRepositoryListener(context, logs, repoState);
    });
  }
}

async function addRepositoryListener(
  context: vscode.ExtensionContext,
  logs: Logs,
  repoState: RepositoryState
) {
  return repoState.onDidChange(() => {
    const tempBranchName = get(context, BRANCH_TEMP_ID_KEY);
    const branchName = repoState.HEAD?.name;
    if (!branchName || (tempBranchName && tempBranchName.id === branchName)) {
      return;
    }

    update(context, BRANCH_NAME, { id: branchName, name: branchName });
    update(context, BRANCH_TEMP_ID_KEY, { id: branchName, name: branchName }); //TODO: This is an hack to fix duplicated onchange calls when branch is changed.

    const projectItem = get(context, PROJECT_ID_KEY);
    const currentBranch = get(context, BRANCH_ID_KEY);

    if (projectItem?.id && branchName && branchName !== currentBranch?.id) {
      getBranches(projectItem.id).then((branches) => {
        update(context, BRANCH_TEMP_ID_KEY, undefined);
        if (branches?.includes(branchName)) {
          update(context, BRANCH_ID_KEY, {
            id: branchName,
            name: `${BRANCH_LABEL} ${branchName}`,
          });
          update(context, SCAN_ID_KEY, { id: undefined, name: SCAN_LABEL });
          vscode.commands.executeCommand(REFRESH_TREE);
        }
      });
    } else {
      update(context, BRANCH_TEMP_ID_KEY, undefined);
    }
  });
}

export function addRealTimeSaveListener(
  context: vscode.ExtensionContext,
  logs: Logs
) {
  // Listen to save action in a KICS file
  vscode.workspace.onDidSaveTextDocument(async (e) => {
    // Check if on save setting is enabled
    const isValidKicsFile = isKicsFile(e);
    const isSystemFiles = isSystemFile(e);
    if (isValidKicsFile && isSystemFiles) {
      const onSave = vscode.workspace
        .getConfiguration("CheckmarxKICS")
        .get("Activate KICS Auto Scanning") as boolean;
      if (onSave) {
        // Check if saved file is within the project
        logs.info("File saved updating KICS results");
        // Send the current file to the global state, to be used in the command
        update(context, KICS_REALTIME_FILE, {
          id: e.uri.fsPath,
          name: e.uri.fsPath,
        });
        await vscode.commands.executeCommand("ast-results.kicsRealtime");
      }
    }
  });

  // Listen to open action in a KICS file
  vscode.workspace.onDidOpenTextDocument(async (e: vscode.TextDocument) => {
    // Check if on save setting is enabled
    const isValidKicsFile = isKicsFile(e);
    const isSystemFiles = isSystemFile(e);
    if (isValidKicsFile && isSystemFiles) {
      logs.info("Opened a supported file by KICS. Starting KICS scan");
      // Mandatory in order to have the document appearing as displayed for VSCode
      await vscode.window.showTextDocument(e, 1, false);
      update(context, KICS_REALTIME_FILE, {
        id: e.uri.fsPath,
        name: e.uri.fsPath,
      });
      await vscode.commands.executeCommand("ast-results.kicsRealtime");
    }
  });
}

export async function setScanButtonDefaultIfScanIsNotRunning(
  context: vscode.ExtensionContext
) {
  const scan = get(context, SCAN_CREATE_ID_KEY);
  if (!scan?.id) {
    vscode.commands.executeCommand(
      "setContext",
      `${EXTENSION_NAME}.isScanEnabled`,
      true
    );
    vscode.commands.executeCommand(
      "setContext",
      `${EXTENSION_NAME}.createScanButton`,
      true
    );
    update(context, SCAN_CREATE_PREP_KEY, { id: false, name: "" });
  }
}

export class WorkspaceListener {
  private _createScanButton: ContextKey;
  private _cancelScanButton: ContextKey;

  constructor() {
    this._createScanButton = new ContextKey(
      `${EXTENSION_NAME}.createScanButton`
    );
    this._cancelScanButton = new ContextKey(
      `${EXTENSION_NAME}.cancelScanButton`
    );
  }

  listener(
    context: vscode.ExtensionContext,
    astResultsProvider: AstResultsProvider
  ) {
    this.isScanButtonEnabled(context, astResultsProvider);
  }

  isScanButtonEnabled(
    context: vscode.ExtensionContext,
    astResultsProvider: AstResultsProvider
  ) {
    const project = get(context, PROJECT_ID_KEY);
    const branch = get(context, BRANCH_ID_KEY);
    const preparingScan = get(context, SCAN_CREATE_PREP_KEY);
    const runningScan = get(context, SCAN_CREATE_ID_KEY);

    if (
      this._createScanButton.set(
        project?.id && branch?.id && !runningScan?.id && !preparingScan?.id
      ) ||
      this._cancelScanButton.set(!!runningScan?.id)
    ) {
      astResultsProvider.refresh();
    }
  }
}

class ContextKey {
  private readonly _name: string;
  private _lastValue: boolean;

  constructor(name: string) {
    this._name = name;
  }

  public set(value: boolean): boolean {
    if (this._lastValue === value) {
      return false;
    }
    this._lastValue = value;
    vscode.commands.executeCommand("setContext", this._name, this._lastValue);
    return true;
  }
}
