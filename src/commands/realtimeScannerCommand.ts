import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
	clearRealtimeScannerProblems,
  scanOSS,
} from "../services/realtimeScannerService";
import { constants } from "../utils/common/constants";

let timeout = null;

export class RealtimeScannerCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  onDidChangeTextDocument: vscode.Disposable;
  constructor(context: vscode.ExtensionContext, logs: Logs) {
	this.context = context;
	this.logs = logs;
  }
  public async registerRealtimeScanner() {
	console.log("registerRealtimeScanner");
	try {
	  const realtimeScannerActive = vscode.workspace
		.getConfiguration(constants.realtimeScanner)
		.get(constants.activateRealtimeScanner) as boolean;
	  if (realtimeScannerActive) {
		console.log("realtimeScannerActive", realtimeScannerActive);
		
		await this.registerScanOnChangeText();
		this.logs.info(constants.realtimeScannerStart);
	  } else {
		await this.disposeAscaScanOnChangeText();
		await clearRealtimeScannerProblems();
		this.logs.info(constants.realtimeScannerDisabled);
	  }
	} catch (error) {
	  console.error(error);
	}
  }
  public installAsca() {
	this.onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
	  // Must be no less than 2000ms. Otherwise, the temporary file can be deleted before the ASCA scan is finished.
	  this.debounce(this.onTextChange, 2000)
	);
  }

  public onTextChange(event) {
	try {
	scanOSS(event.document, this.logs);
	} catch (error) {
	  console.error(error);
	  this.logs.warn("fail to scan OSS");
	}
  }
  // Debounce function
  public debounce(func, wait) {
	const context = this;
	console.log("onDidChangeTextDocument");
	return function (...args) {
	  try {
		const later = () => {
		  clearTimeout(timeout);
		  func.apply(context, args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	  } catch (error) {
		console.error(error);
	  }
	};
  }

  public registerScanOnChangeText() {
	this.context.subscriptions.push(this.onDidChangeTextDocument);
  }
  public disposeAscaScanOnChangeText() {
	if (this.onDidChangeTextDocument) {
	  this.onDidChangeTextDocument.dispose();
	  this.context.subscriptions.push(this.onDidChangeTextDocument);
	}
  }
}