import * as vscode from "vscode";
import kill from "tree-kill";
import * as path from "path";
import { join } from "path";
import { Logs } from "../models/logs";
import {
  constants
} from "../utils/common/constants";
import { getFromState, updateState } from "../utils/common/globalState";
import CxKicsRealTime from "@checkmarx/ast-cli-javascript-wrapper/dist/main/kicsRealtime/CxKicsRealTime";
import { CxCommandOutput } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/wrapper/CxCommandOutput";
import { KicsCodeActionProvider } from "./kicsCodeActions";
import { cx } from "../cx";
import { writeFileSync } from "fs";
import { KicsDiagnostic } from "./kicsDiagnostic";
import { commands } from "../utils/common/commandBuilder";
import { KicsSummary } from "../models/kicsNode";
import { messages } from "../utils/common/messages";

export class KicsProvider {
  public process;
  public codeLensDisposable: vscode.Disposable;
  public codeActionDisposable: vscode.Disposable;
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logs: Logs,
    private readonly kicsStatusBarItem: vscode.StatusBarItem,
    private readonly diagnosticCollection: vscode.DiagnosticCollection,
    private fixableResults,
    private readonly fixableResultsByLine
  ) {
    const onSave = vscode.workspace
      .getConfiguration(constants.cxKics)
      .get(constants.cxKicsAutoScan) as boolean;
    this.kicsStatusBarItem.text =
      onSave === true
        ? messages.kicsStatusBarConnect
        : messages.kicsStatusBarDisconnect;
    this.kicsStatusBarItem.tooltip = messages.kicsAutoScan;
    this.kicsStatusBarItem.command = commands.kicsSetings;
    vscode.commands.executeCommand(commands.refreshKicsStatusBar);
    this.fixableResults = [];
    this.fixableResultsByLine = [];
  }

  async runKicsIfEnabled() {
    try {
      const isKicksAutoscanEnabled = vscode.workspace
        .getConfiguration("CheckmarxKICS")
        .get("Activate KICS Real-time Scanning") as boolean;

      if (isKicksAutoscanEnabled) {
        this.logs.info(messages.kicsSupportedFile);
        await this.runKics();
      }
    } catch (err) {
      throw new Error(err.message);
    }
  }

  async runKics() {
    this.kicsStatusBarItem.text =
      messages.kicsAutoScanRunning;
    this.kicsStatusBarItem.tooltip = messages.kicsRunning;
    await vscode.commands.executeCommand(commands.refreshKicsStatusBar);
    // Get current file, either from global state or from the current open file
    const file = await this.getCurrentFile(this.context, this.logs);
    if (!file) {
      return;
    }

    // Get the last process from global state, if present we try to kill it to avoid process spawn spam
    const savedProcess = getFromState(this.context, constants.processObject);
    if (savedProcess && savedProcess.id) {
      kill(savedProcess.id.pid);
      updateState(this.context, constants.processObject, {
        id: undefined,
        name: constants.processObjectKey,
        scanDatetime: undefined,
        displayScanId: undefined
      });
    }

    // Clear the KICS diagnostics
    this.applyKicsDiagnostic(
      new CxKicsRealTime(),
      file.editor.document.uri,
      this.diagnosticCollection
    );
    if (this.codeLensDisposable) {
      this.codeLensDisposable.dispose();
    }
    if (this.codeActionDisposable) {
      this.codeActionDisposable.dispose();
    }

    // Create the KICS scan
    const [createObject, process] = await this.createKicsScan(file.file);

    // update the current cli spawned process returned by the wrapper
    this.process = process;
    updateState(this.context, constants.processObject, {
      id: this.process,
      name: constants.processObjectKey,
      displayScanId: undefined,
      scanDatetime: undefined
    });

    // async wait for the KICS scan to end to create the diagnostics and print the summary
    createObject
      .then((cxOutput: CxCommandOutput) => {
        if (cxOutput.exitCode !== 0) {
          throw new Error(cxOutput.status);
        }
        // Get the results
        if (cxOutput.payload) {
          const kicsResults = cxOutput.payload[0];

          for (const kicsResult of kicsResults.results) {
            kicsResult.files[0].file_name = file.editor.document.uri.fsPath;
          }

          // Logs the results summary to the output
          this.resultsSummaryLogs(kicsResults, this.logs);
          // Get the results into the problems
          this.applyKicsDiagnostic(
            kicsResults,
            file.editor.document.uri,
            this.diagnosticCollection
          );
          // Get the results into codelens
          if (this.codeLensDisposable) {
            this.codeLensDisposable.dispose();
          }
          if (this.codeActionDisposable) {
            this.codeActionDisposable.dispose();
          }
          this.codeLensDisposable = this.applyKicsCodeLensProvider(
            { pattern: file.file },
            kicsResults
          );
          this.kicsStatusBarItem.text = messages.kicsStatusBarConnect;
          this.updateKicsFixableResults(this.diagnosticCollection);
          this.codeActionDisposable =
            vscode.languages.registerCodeActionsProvider(
              file.editor.document.uri,
              new KicsCodeActionProvider(
                kicsResults,
                file,
                this.diagnosticCollection,
                this.fixableResults,
                this.fixableResultsByLine
              )
            );
        }
      })
      .catch((error) => {
        this.kicsStatusBarItem.tooltip = messages.kicsAutoScan;
        if (error.message && error.message.length > 0) {
          this.kicsStatusBarItem.text = messages.kicsStatusBarError;
          this.kicsStatusBarItem.tooltip = messages.kicsAutoScan;
          this.logs.error(error);
          updateState(this.context, constants.processObject, {
            id: undefined,
            name: constants.processObjectKey,
            displayScanId: undefined,
            scanDatetime: undefined
          });
        }
      });
  }

  async kicsRemediation(
    fixedResults,
    kicsResults,
    file,
    diagnosticCollection: vscode.DiagnosticCollection,
    fixAll,
    fixLine,
    logs
  ) {
    // Call KICS remediation
    this.kicsStatusBarItem.text =
      messages.kicsFixRunning;
    const kicsFile = path.dirname(file.file);
    const resultsFile = this.createKicsResultsFile(kicsResults);
    let similarityIdFilter = "";
    if (fixAll === false && fixLine === false) {
      fixedResults[0].files.forEach(
        (element) => (similarityIdFilter += element.similarity_id + ",")
      );
      similarityIdFilter = similarityIdFilter.slice(0, -1);
    }
    if (fixLine) {
      fixedResults.forEach((result) => {
        result.files.forEach(
          (element) => (similarityIdFilter += element.similarity_id + ",")
        );
      });
      similarityIdFilter = similarityIdFilter.slice(0, -1);
    }
    const [createObject] = await cx.kicsRemediation(
      resultsFile,
      kicsFile,
      "",
      similarityIdFilter
    );
    createObject
      .then(async (cxOutput: CxCommandOutput) => {
        if (cxOutput.exitCode === 0) {
          // Remove the specific kicsResult from the list of kicsResults
          // Update the list of fixable results for the quick fix all
          kicsResults.results = kicsResults.results.filter(
            (totalResultsElement) => {
              return !fixedResults.includes(totalResultsElement);
            }
          );
          // Remove codelens, previous diagnostics and actions
          this.applyKicsDiagnostic(
            new CxKicsRealTime(),
            file.editor.document.uri,
            diagnosticCollection
          );
          this.codeLensDisposable.dispose();
          // Information messages
          const message = !fixAll
            ? fixedResults[0].query_name
            : "the entire file";
          vscode.window.showInformationMessage("Fix applied to " + message);
          this.remediationSummaryLogs(cxOutput.payload, this.logs);
          logs.info("Fixes applied to " + message);
          this.kicsStatusBarItem.text = messages.kicsStatusBarConnect;
          this.updateKicsFixableResults(diagnosticCollection);
          vscode.commands.executeCommand(commands.kicsRealtime);
        } else {
          logs.error("Error applying fix: " + JSON.stringify(cxOutput.payload));
        }
      })
      .catch((err) => {
        logs.error("Error applying fix: " + err);
      });
  }

  createKicsResultsFile(kicsResults): string {
    const fullPath = join(__dirname, constants.kicsResultsFile);
    try {
      // this was needed to match our structure with the original KICS results field names
      kicsResults[constants.kicsQueries] = kicsResults[constants.kicsResults];
      kicsResults[constants.kicsTotalCounter] = kicsResults[constants.kicsCount];
      delete kicsResults[constants.kicsResults];
      delete kicsResults[constants.kicsCount];
      // results to string, to be written to the file
      const data = JSON.stringify(kicsResults);
      // revert changes in the results object
      kicsResults[constants.kicsResults] = kicsResults[constants.kicsQueries];
      kicsResults[constants.kicsCount] = kicsResults[constants.kicsTotalCounter];
      delete kicsResults[constants.kicsQueries];
      delete kicsResults[constants.kicsTotalCounter];
      writeFileSync(fullPath, data, {
        flag: "w",
      });
    } catch (error) {
      return "";
    }
    return fullPath;
  }

  updateKicsFixableResults(diagnosticCollection: vscode.DiagnosticCollection) {
    diagnosticCollection.forEach((_, diagnostics) => {
      diagnostics.forEach((diagnostic: KicsDiagnostic) => {
        // Check if the diagnostic has a fix
        const fixable = KicsCodeActionProvider.filterFixableResults(diagnostic);
        if (fixable) {
          // Add the result to the fix all list
          this.fixableResults.push(diagnostic.kicsResult);
          const key = diagnostic.range.start.line;
          const index = this.findObjectIndexInList(
            this.fixableResultsByLine,
            key
          );
          if (index >= 0) {
            const testIndex = this.fixableResultsByLine[index];
            const testKey = testIndex[key];
            this.fixableResultsByLine[index][key].push(diagnostic.kicsResult);
            console.log(testKey);
          } else {
            this.fixableResultsByLine.push({ [key]: [diagnostic.kicsResult] });
          }
        }
        return fixable;
      });
    });
  }

  // Create the auto kics scan
  async createKicsScan(file: string | undefined) {
    let results;
    try {
      let additionalParams = vscode.workspace
        .getConfiguration("CheckmarxKICS")
        .get("Additional Parameters") as string;
      additionalParams = additionalParams.replace(/("[^"]*")|\s+/g, (match, quoted) => quoted ? quoted : ",");
      if (file) {
        results = await cx.getResultsRealtime(file, additionalParams);
      } else {
        throw new Error("file is not defined on kics scan creation");
      }
    } catch (err) {
      throw new Error(err.message);
    }
    return results;
  }

  resultsSummaryLogs(kicsResults: CxKicsRealTime, logs: Logs) {
    logs.info(
      "Results summary:" +
      JSON.stringify(kicsResults?.summary, null, 2)
        .replaceAll("{", "")
        .replaceAll("}", "")
    );
    // Decide wether or not to print the quick fix available information
    if (this.checkIfAnyFixable(kicsResults)) {
      logs.info(
        "Check out KICS Auto-remediation: hover the mouse over the result line and use ⌘. or ctrl."
      );
    }
  }

  // Function that checks if there is any KICS fixable result
  checkIfAnyFixable(kicsResults: CxKicsRealTime): boolean {
    let r = false;
    for (const result of kicsResults.results) {
      if (result.files[0].remediation !== "") {
        r = true;
        break;
      }
    }
    return r;
  }

  remediationSummaryLogs(remediation: object, logs: Logs) {
    logs.info(
      "Remediation summary:" +
      JSON.stringify(remediation, null, 2)
        .replaceAll("{", "")
        .replaceAll("}", "")
    );
  }

  // Main Diagnostic function, creates and applies the problems for kics realtime results
  applyKicsDiagnostic(
    kicsResults: CxKicsRealTime,
    uri: vscode.Uri,
    diagnosticCollection: vscode.DiagnosticCollection
  ) {
    diagnosticCollection.clear();

    const kicsDiagnostic: KicsDiagnostic[] = [];
    for (const kicsResult of kicsResults.results) {
      const file = kicsResult.files[0];
      const startPosition = new vscode.Position(file.line - 1, 0);
      const endPosition = new vscode.Position(file.line - 1, 999);
      kicsDiagnostic.push({
        message: `${kicsResult.query_name} (${kicsResult.severity.charAt(0) +
          kicsResult.severity.slice(1).toLowerCase()
          })
  "${kicsResult.description}"
  Value: 
   ${kicsResult.query_name}
  Recommended fix: 
   ${file.expected_value}
       `,
        kicsResult: kicsResult,
        range: new vscode.Range(startPosition, endPosition),
        severity: this.getSeverityCode(kicsResult.severity),
        source: "KICS ",
        code: {
          value: `${kicsResult.query_name}`,
          target: vscode.Uri.parse(kicsResult.query_url),
        },
      });
    }

    diagnosticCollection.set(uri, kicsDiagnostic);
  }

  // Get the correct Diagnostic to apply in problems
  getSeverityCode(severity) {
    switch (severity) {
      case "HIGH":
        return vscode.DiagnosticSeverity.Error;
      case "MEDIUM":
        return vscode.DiagnosticSeverity.Warning;
      case "INFO":
        return vscode.DiagnosticSeverity.Information;
      case "LOW":
        return vscode.DiagnosticSeverity.Information;
    }
    return vscode.DiagnosticSeverity.Information;
  }

  // Register codeLens
  applyKicsCodeLensProvider(
    file: vscode.DocumentSelector,
    kicsResults: CxKicsRealTime
  ): vscode.Disposable {
    const codelens = vscode.languages.registerCodeLensProvider(file, {
      provideCodeLenses() {
        if (this.getKicsCodeLensProvider) {
          return this.getKicsCodeLensProvider(kicsResults);
        }
      },
    });

    return codelens;
  }

  // Add content to the codeLen provider
  getKicsCodeLensProvider(
    kicsResults: CxKicsRealTime
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const resultsmap: Map<number, KicsSummary> = new Map<number, KicsSummary>();
    for (const kicsResult of kicsResults.results) {
      const file = kicsResult.files[0];
      const line = file.line - 1;

      if (!resultsmap.has(line)) {
        resultsmap.set(line, new KicsSummary(0, 0, 0, 0));
      }

      const summary = resultsmap.get(line);
      summary[kicsResult.severity] += 1;
    }

    const codeLensResults: vscode.CodeLens[] =
      this.generateCodeLens(resultsmap);
    return codeLensResults;
  }

  // Get the current opened file in order to run the realtime scan
  async getCurrentFile(
    context: vscode.ExtensionContext,
    logs: Logs
  ): Promise<{ file: string | undefined; editor: vscode.TextEditor }> {
    let file = getFromState(context, constants.kicsRealtimeFile)?.id;
    const opened = vscode.window.activeTextEditor;
    if (!file) {
      if (opened && opened.document.fileName.length > 0) {
        file = opened.document.fileName;
      } else {
        logs.error(
          "No file opened or file not in focus. Please open and click one file to run kics real-time scan"
        );
      }
    }
    if (opened) {
      return { file: file, editor: opened };
    } else {
      logs.error(
        "No file opened or file not in focus. Please open and click one file to run kics real-time scan"
      );
    }
  }

  // Go throw the kics results and generate the message for each codelens entry in the file
  generateCodeLens(resultsmap: Map<number, KicsSummary>): vscode.CodeLens[] {
    const codeLensResults: vscode.CodeLens[] = [];
    for (const result of resultsmap.entries()) {
      const line = result[0];
      const count = result[1];
      let message = "KICS:";
      if (count["HIGH"] > 0) {
        message += " HIGH: " + count["HIGH"] + " | ";
      }
      if (count["MEDIUM"] > 0) {
        message += " MEDIUM: " + count["MEDIUM"] + " | ";
      }
      if (count["LOW"] > 0) {
        message += " LOW: " + count["LOW"] + " | ";
      }
      if (count["INFO"] > 0) {
        message += " INFO: " + count["INFO"] + " | ";
      }

      codeLensResults.push(
        new vscode.CodeLens(
          new vscode.Range(
            new vscode.Position(line, 0),
            new vscode.Position(line, 999)
          ),
          {
            title: message.slice(0, -2),
            tooltip: "",
            command: "",
            arguments: [],
          }
        )
      );
    }
    return codeLensResults;
  }

  findObjectIndexInList(list, key) {
    let foundIndex = -1;
    list.forEach((element, index) => {
      if (element[key]) {
        foundIndex = index;
      }
    });
    return foundIndex;
  }
}
