import * as vscode from "vscode";
import { KicsDiagnostic } from "./kicsDiagnostic";
import { commands } from "../utils/common/commandBuilder";
import { constants } from "../utils/common/constants";
import { GptResult } from "../models/gptResult";
export class KicsCodeActionProvider implements vscode.CodeActionProvider {
  private readonly kicsResults;
  private readonly file: { file: string; editor: vscode.TextEditor };
  private readonly diagnosticCollection: vscode.DiagnosticCollection;
  private readonly fixableResults: [];
  private fixableResultsByLine: [];

  constructor(
    kicsResults,
    file: { file: string; editor: vscode.TextEditor },
    diagnosticCollection: vscode.DiagnosticCollection,
    fixableResults: [],
    fixableResultsByLine: []
  ) {
    this.kicsResults = kicsResults;
    this.file = file;
    this.diagnosticCollection = diagnosticCollection;
    this.fixableResults = fixableResults;
    this.fixableResultsByLine = fixableResultsByLine;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    // List of fixable results for the fix all action
    const fixAllResults = [];
    return context.diagnostics
      .filter((diagnostic: KicsDiagnostic) => {
        // Check if the diagnostic has a fix
        const fixable = KicsCodeActionProvider.filterFixableResults(diagnostic);
        if (fixable) {
          // Add the result to the fix all list
          fixAllResults.push(diagnostic.kicsResult);
        }
        return fixable;
      })
      .map((diagnostic: KicsDiagnostic) =>
        this.createCommandCodeAction(diagnostic)
      )
      .concat(
        this.fixableResultsByLine.length > 0 && fixAllResults.length > 1
          ? this.createFixGroupCodeAction(
            this.fixableResultsByLine,
            fixAllResults
          )
          : []
      )
      .concat(
        fixAllResults.length > 0
          ? this.createFixFileCodeAction(
            new vscode.Diagnostic(
              new vscode.Range(
                new vscode.Position(0, 0),
                new vscode.Position(0, 0)
              ),
              "Quick Fix"
            ),
            this.fixableResults
          )
          : []
      )
      .concat(this.createAskKICSCodeAction(context)); // Add the fix all action if there is more than one fix in the file
  }

  // Create individual quick fix
  private createCommandCodeAction(
    diagnostic: KicsDiagnostic
  ): vscode.CodeAction {
    const valueOf: string | number | object = diagnostic.code.valueOf();
    const queryName = Object(valueOf).value;
    // used to be able to use kicsDiagnostic typ without changing the context implementation
    const kicsDiagnostic: KicsDiagnostic = diagnostic;
    const action = new vscode.CodeAction(
      "Apply fix to " + queryName,
      vscode.CodeActionKind.QuickFix
    );
    action.command = {
      command: commands.kicsRemediation,
      title: "KICS fix",
      tooltip: "This will apply KICS fix for the vulnerability",
      arguments: [
        [kicsDiagnostic.kicsResult],
        this.kicsResults,
        this.file,
        this.diagnosticCollection,
        false,
        false,
      ],
    };
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return action;
  }

  // Create quick fix for the entire file
  private createFixFileCodeAction(
    diagnostic: vscode.Diagnostic,
    fixableResults
  ): vscode.CodeAction[] {
    // used to be able to use kicsDiagnostic typ without changing the context implementation
    const action = new vscode.CodeAction(
      "File : Apply all available fixes",
      vscode.CodeActionKind.QuickFix
    );
    action.command = {
      command: commands.kicsRemediation,
      title: "KICS fix",
      tooltip: "This will apply KICS fix for the vulnerability",
      arguments: [
        fixableResults,
        this.kicsResults,
        this.file,
        this.diagnosticCollection,
        true,
        false,
      ],
    };
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return [action];
  }

  // Create quick fix for the group
  private createFixGroupCodeAction(
    fixableResultsByLine,
    fixAllResults
  ): vscode.CodeAction[] {
    // used to be able to use kicsDiagnostic typ without changing the context implementation
    const actions: vscode.CodeAction[] = [];
    fixableResultsByLine.forEach((objectResult, index) => {
      const lines = Object.keys(objectResult);
      const values = Object.values(objectResult);
      if (values.length > 0) {
        values.forEach((results: []) => {
          // Check if it should be added to this specific line, by going throw the lines results and compare them
          const contains = fixAllResults.every((element: never) => {
            return results.includes(element);
          });
          if (contains) {
            const vscodeRange: vscode.Range = new vscode.Range(
              new vscode.Position(parseInt(lines[index]), 0),
              new vscode.Position(parseInt(lines[index]), 999)
            );
            console.log(vscodeRange.start);
            const diagnostic = new vscode.Diagnostic(vscodeRange, "Quick Fix");
            const action = new vscode.CodeAction(
              "Line : Apply all available fixes",
              vscode.CodeActionKind.QuickFix
            );
            action.command = {
              command: commands.kicsRemediation,
              title: "KICS fix",
              tooltip: "This will apply KICS fix for the vulnerability",
              arguments: [
                fixAllResults,
                this.kicsResults,
                this.file,
                this.diagnosticCollection,
                false,
                true,
              ],
            };
            action.diagnostics = [diagnostic];
            action.isPreferred = true;
            actions.push(action);
          }
        });
      }
    });
    return actions;
  }

  private createAskKICSCodeAction(
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    // used to be able to use kicsDiagnostic typ without changing the context implementation
    const actions: vscode.CodeAction[] = [];
    context.diagnostics.forEach((diagnostic: KicsDiagnostic) => {
      const valueOf: string | number | object = diagnostic.code.valueOf();
      const queryName = Object(valueOf).value;
      const action = new vscode.CodeAction(
        `${constants.aiSecurityChampion} ` + queryName,
        vscode.CodeActionKind.Empty.append("custom")
      );
      const convertedResult = new GptResult(undefined, diagnostic.kicsResult);

      action.command = {
        command: commands.gpt,
        title: `${constants.aiSecurityChampion}`,
        tooltip: `This will open an ${constants.aiSecurityChampion} tab for the vulnerability`,
        arguments: [convertedResult, constants.realtime],
      };
      action.diagnostics = [diagnostic];
      action.isPreferred = true;
      actions.push(action);
    });
    return actions;
  }

  public static filterFixableResults(diagnostic: KicsDiagnostic): boolean {
    let fixable = false;
    diagnostic.kicsResult.files.forEach((file) => {
      if (file.remediation !== "") {
        // filter only results that have remediation
        fixable = true;
      }
    });
    return fixable;
  }
}
