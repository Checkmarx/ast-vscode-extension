import * as vscode from "vscode";
import { AstResultsProvider } from "../../views/resultsView/astResultsProvider";
import {
  EXTENSION_NAME,
  PROJECT_ID_KEY,
  BRANCH_ID_KEY,
  SCAN_CREATE_PREP_KEY,
  SCAN_CREATE_ID_KEY,
} from "../common/constants";
import { get } from "../common/globalState";
import { ContextKey } from "./contextKey";

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
