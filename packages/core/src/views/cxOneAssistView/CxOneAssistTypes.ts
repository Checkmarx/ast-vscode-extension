import * as vscode from "vscode";
import { IgnoreFileManager } from "../../realtimeScanners/common/ignoreFileManager";

export interface CxOneAssistDependencies {
	context: vscode.ExtensionContext;
	ignoreFileManager: IgnoreFileManager;
}

export interface CxOneAssistWebviewState {
	ignoredCount: number;
	hasIgnoreFile: boolean;
	isStandaloneEnabled: boolean;
	isAuthenticated: boolean;
	isCxOneAssistEnabled: boolean;
}

export interface CxOneAssistMessage {
	command: string;
	data?: unknown;
}