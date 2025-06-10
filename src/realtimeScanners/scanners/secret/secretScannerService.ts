import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerService } from "../../common/baseScannerService";
import { IScannerConfig } from "../../common/types";
import { constants } from "../../../utils/common/constants";
import { minimatch } from "minimatch";
import path from "path";

type Location = {//TODO: Replace with cx wrapper type
	startLine: number;
	endLine: number;
	startColumn: number;
	endColumn: number;
}

type SecretProblem = {//TODO: Replace with cx wrapper type
	title: string;
	description: string;
	filePath: string;
	severity: 'critical' | 'high' | 'medium' | 'low';
	locations: Location[];
};

export class SecretScannerService extends BaseScannerService {
	private diagnosticsMap: Map<string, vscode.Diagnostic[]> = new Map();
	private criticalDecorations: Map<string, vscode.DecorationOptions[]> = new Map();
	private highDecorations: Map<string, vscode.DecorationOptions[]> = new Map();
	private mediumDecorations: Map<string, vscode.DecorationOptions[]> = new Map();
	private lowDecorations: Map<string, vscode.DecorationOptions[]> = new Map();

	private documentOpenListener: vscode.Disposable | undefined;
	private editorChangeListener: vscode.Disposable | undefined;

	private createDecoration(iconName: string, size: string = "auto"): vscode.TextEditorDecorationType {
		return vscode.window.createTextEditorDecorationType({
			gutterIconPath: vscode.Uri.file(
				path.join(__dirname, "..", "..", "..", "..", "media", "icons", iconName)
			),
			rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			gutterIconSize: size
		});
	}

	private decorationTypes = {
		critical: this.createDecoration("critical_untoggle.svg", "12px"),
		high: this.createDecoration("high_untoggle.svg"),
		medium: this.createDecoration("medium_untoggle.svg"),
		low: this.createDecoration("low_untoggle.svg")
	};

	constructor() {
		const config: IScannerConfig = {
			engineName: constants.secretScannerEngineName,
			configSection: constants.secretScanner,
			activateKey: constants.activateSecretScanner,
			enabledMessage: constants.secretScannerStart,
			disabledMessage: constants.secretScannerDisabled,
			errorMessage: constants.errorSecretScanRealtime,
		};
		super(config);
	}

	shouldScanFile(document: vscode.TextDocument): boolean {
		if (!super.shouldScanFile(document)) {
			return false;
		}

		const filePath = document.uri.fsPath.replace(/\\/g, "/");
		if (constants.supportedManifestFilePatterns.some(pattern =>
			minimatch(filePath, pattern))
		) {
			return false;
		}

		return true
	}

	public async scan(document: vscode.TextDocument, logs: Logs): Promise<void> {
		if (!this.shouldScanFile(document)) {
			return;
		}

		const filePath = document.uri.fsPath;
		logs.info("Scanning for secrets in file: " + filePath);

		try {//TODO: call a real secret scanning from cx
			const text = document.getText();
			const problems: SecretProblem[] = [];

			const lines = text.split("\n");
			lines.forEach((line, index) => {
				const lowerLine = line.toLowerCase();
				if (lowerLine.includes("secret")) {
					// Simulated severity based on content
					let severity: SecretProblem['severity'] = 'low';
					let title = "Generic Secret Found";
					let description = "A potential secret was found in the code";

					if (lowerLine.includes("password") || lowerLine.includes("key")) {
						severity = 'critical';
						title = "Critical Security Key Found";
						description = "A potential password or security key was detected";
					} else if (lowerLine.includes("token")) {
						severity = 'high';
						title = "High Risk Token Found";
						description = "A potential access token was detected";
					} else if (lowerLine.includes("credential")) {
						severity = 'medium';
						title = "Credential Found";
						description = "A potential credential was detected";
					}

					problems.push({
						title,
						description,
						filePath: document.uri.fsPath,
						severity,
						locations: [{
							startLine: index,
							endLine: index,
							startColumn: line.indexOf(line.trim()),
							endColumn: line.indexOf(line.trim()) + line.trim().length
						}]
					});
				}
			});

			this.updateProblems(problems, document.uri);
		} catch (error) {
			console.error(error);
			logs.error(this.config.errorMessage + `: ${error}`);
		}
	}

	updateProblems<T = unknown>(problems: T, uri: vscode.Uri): void {
		const secretProblems = problems as SecretProblem[];
		const filePath = uri.fsPath;

		const diagnostics: vscode.Diagnostic[] = [];
		const criticalDecorations: vscode.DecorationOptions[] = [];
		const highDecorations: vscode.DecorationOptions[] = [];
		const mediumDecorations: vscode.DecorationOptions[] = [];
		const lowDecorations: vscode.DecorationOptions[] = [];

		for (const problem of secretProblems) {
			if (problem.locations.length === 0) continue;

			const location = problem.locations[0];
			const range = new vscode.Range(
				new vscode.Position(location.startLine, location.startColumn),
				new vscode.Position(location.endLine, location.endColumn)
			);

			const severityMap = {
				critical: vscode.DiagnosticSeverity.Error,
				high: vscode.DiagnosticSeverity.Error,
				medium: vscode.DiagnosticSeverity.Warning,
				low: vscode.DiagnosticSeverity.Information
			};

			const diagnostic = new vscode.Diagnostic(
				range,
				`${problem.title}\n${problem.description}`,
				severityMap[problem.severity]
			);

			diagnostics.push(diagnostic);

			const decoration = { range };
			switch (problem.severity) {
				case 'critical': //Maybe use in CxManifestStatus Enum, and rename this class.
					criticalDecorations.push(decoration);
					break;
				case 'high':
					highDecorations.push(decoration);
					break;
				case 'medium':
					mediumDecorations.push(decoration);
					break;
				case 'low':
					lowDecorations.push(decoration);
					break;
			}
		}

		this.diagnosticsMap.set(filePath, diagnostics);
		this.diagnosticCollection.set(uri, diagnostics);
		
		this.criticalDecorations.set(filePath, criticalDecorations);
		this.highDecorations.set(filePath, highDecorations);
		this.mediumDecorations.set(filePath, mediumDecorations);
		this.lowDecorations.set(filePath, lowDecorations);

		this.applyDecorations(uri);
	}

	public async clearProblems(): Promise<void> {
		await super.clearProblems();
		this.diagnosticsMap.clear();
		this.criticalDecorations.clear();
		this.highDecorations.clear();
		this.mediumDecorations.clear();
		this.lowDecorations.clear();
	}
	public dispose(): void {
		Object.values(this.decorationTypes).forEach(decoration => decoration.dispose());

		if (this.documentOpenListener) {
			this.documentOpenListener.dispose();
		}

		if (this.editorChangeListener) {
			this.editorChangeListener.dispose();
		}
	}

	public async initializeScanner(): Promise<void> {
		this.documentOpenListener = vscode.workspace.onDidOpenTextDocument(
			this.onDocumentOpen.bind(this)
		);
		this.editorChangeListener = vscode.window.onDidChangeActiveTextEditor(
			this.onEditorChange.bind(this)
		);
	}

	private onDocumentOpen(document: vscode.TextDocument): void {
		if (this.shouldScanFile(document)) {
			this.applyDecorations(document.uri);
		}
	}

	private onEditorChange(editor: vscode.TextEditor | undefined): void {
		if (editor && this.shouldScanFile(editor.document)) {
			this.applyDecorations(editor.document.uri);
		}
	}

	private applyDecorations(uri: vscode.Uri): void {
		const editor = vscode.window.visibleTextEditors.find(
			e => e.document.uri.toString() === uri.toString()
		);
		if (!editor) {
			return;
		}

		const filePath = uri.fsPath;
		const criticalDecorations = this.criticalDecorations.get(filePath) || [];
		const highDecorations = this.highDecorations.get(filePath) || [];
		const mediumDecorations = this.mediumDecorations.get(filePath) || [];
		const lowDecorations = this.lowDecorations.get(filePath) || [];

		editor.setDecorations(this.decorationTypes.critical, criticalDecorations);
		editor.setDecorations(this.decorationTypes.high, highDecorations);
		editor.setDecorations(this.decorationTypes.medium, mediumDecorations);
		editor.setDecorations(this.decorationTypes.low, lowDecorations);
	}
}
