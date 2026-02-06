import * as vscode from "vscode";
import { AstResultsProvider } from "../../views/resultsView/astResultsProvider";
import {
  constants
} from "../common/constants";
import { getFromState } from "../common/globalState";
import { ContextKey } from "./contextKey";

export class WorkspaceListener {
  private _createScanButton: ContextKey;
  private _cancelScanButton: ContextKey;

  constructor() {
    this._createScanButton = new ContextKey(
      `${constants.extensionName}.createScanButton`
    );
    this._cancelScanButton = new ContextKey(
      `${constants.extensionName}.cancelScanButton`
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
    const project = getFromState(context, constants.projectIdKey);
    const branch = getFromState(context, constants.branchIdKey);
    const preparingScan = getFromState(context, constants.scanCreatePrepKey);
    const runningScan = getFromState(context, constants.scanCreateIdKey);

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
