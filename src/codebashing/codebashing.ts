import * as vscode from "vscode";
import { cx } from "../cx";
import { Logs } from "../models/logs";
import {
  constants
} from "../utils/common/constants";
import AstError from "../exceptions/AstError";
import { messages } from "../utils/common/messages";

const CODEBASHING_NO_LICENSE =
  "You don't have a license for Codebashing. Please Contact your Admin for the full version implementation. Meanwhile, you can use the link below.";
const CODEBASHING_NO_LESSON = "Currently, this vulnerability has no lesson";

const PROGRESS_HEADER: vscode.ProgressOptions = {
  location: vscode.ProgressLocation.Notification,
  title: messages.fetchCodebashing,
  cancellable: false,
};

export async function getCodebashingLink(
  queryId: string,
  logs: Logs
) {
  vscode.window.withProgress(PROGRESS_HEADER, async (progress, token) => {
    token.onCancellationRequested(() => logs.info(messages.cancelCodebashingLoad));
    try {
      await handleExistingLink(logs, queryId);
    } catch (err) {
      handleUnexistingLink(logs, err);
    }
  });
}

async function handleExistingLink(logs: Logs, queryId: string) {
  logs.info(messages.fetchCodebashing);
  const codeBashingArray = await cx.getCodeBashing(queryId);
  vscode.env.openExternal(vscode.Uri.parse(codeBashingArray?.lessonUrl));
}

function handleUnexistingLink(logs: Logs, err) {
  logs.error(messages.failedCodebashing);
  if (err instanceof AstError) {
    if (err.code === constants.astErrorCodeBashingNoLicense) {
      vscode.window
        .showInformationMessage(CODEBASHING_NO_LICENSE, messages.codebashing)
        .then(() =>
          vscode.env.openExternal(
            vscode.Uri.parse(messages.codeBashingUrl)
          )
        );
      return;
    } else if (err.code === constants.astErrorCodeBashingNoLesson) {
      vscode.window.showInformationMessage(CODEBASHING_NO_LESSON);
      return;
    }
  }

  vscode.window.showWarningMessage(
    String(err).replace(constants.errorRegex, "").replaceAll("\n", "")
  );
}