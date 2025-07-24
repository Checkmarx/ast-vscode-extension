/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { AscaScannerService } from "./ascaScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { constants } from "../../../utils/common/constants";
import { buildCommandButtons, renderCxAiBadge } from "../../../utils/utils";
import { AscaHoverData } from "../../common/types";
import { cx } from "../../../cx";

export class AscaScannerCommand extends BaseScannerCommand {
	constructor(
		context: vscode.ExtensionContext,
		logs: Logs,
		configManager: ConfigurationManager
	) {
		const scannerService = new AscaScannerService();
		super(context, logs, scannerService.config, scannerService, configManager);
	}

	private hoverProviderDisposable: vscode.Disposable | undefined;

	protected async initializeScanner(): Promise<void> {
		const res = await cx.installAsca();
		if (res.error) {
			const errorMessage = constants.errorAscaInstallation + " : " + res.error;
			vscode.window.showErrorMessage(errorMessage);
			return;
		}
		this.registerScanOnChangeText();
		const scanner = this.scannerService as AscaScannerService;
		scanner.initializeScanner();

		if (this.hoverProviderDisposable) {
			this.hoverProviderDisposable.dispose();
		}

		this.hoverProviderDisposable = vscode.languages.registerHoverProvider(
			{ scheme: "file" },
			{ provideHover: (doc, pos) => this.getHover(doc, pos, scanner) }
		);

		vscode.workspace.onDidRenameFiles(async (event) => {
			for (const { oldUri, newUri } of event.files) {
				scanner.clearScanData(oldUri);

				const reopenedDoc = await vscode.workspace.openTextDocument(newUri);
				if (reopenedDoc && scanner.shouldScanFile(reopenedDoc)) {
					await scanner.scan(reopenedDoc, this.logs);
				}
			}
		});
	}

	private getHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		scanner: AscaScannerService
	) {
		const key = `${document.uri.fsPath}:${position.line}`;
		const hoverData: AscaHoverData = scanner.getHoverData()?.get(key);
		const diagnostics = scanner.getDiagnosticsMap()?.get(document.uri.fsPath) || [];
		const hasDiagnostic = diagnostics.some(
			(d) => d.range.start.line === position.line
		);

		if (!hoverData || !hasDiagnostic) {
			return;
		}

		const md = new vscode.MarkdownString();
		md.supportHtml = true;
		md.isTrusted = true;

		// Display rule name and description as per requirements
		const ruleHeader = `**Rule:** ${hoverData.ruleName}\n\n`;

		// Include description with truncation support as per requirements
		let description = hoverData.description;
		if (description && description.length > 200) {
			description = description.substring(0, 197) + "...";
		}
		const descriptionText = `**Description:** ${description}\n\n`;

		// Create command arguments for the buttons
		const args = encodeURIComponent(JSON.stringify([hoverData]));
		const buttons = buildCommandButtons(args);

		md.appendMarkdown(ruleHeader);
		md.appendMarkdown(descriptionText);
		md.appendMarkdown(renderCxAiBadge() + "<br>");
		md.appendMarkdown(`${buttons}<br>`);
		md.appendMarkdown(this.renderSeverityIcon(hoverData.severity));

		return new vscode.Hover(md);
	}

	private renderSeverityIcon(severity: string): string {
		const severityLower = severity.toLowerCase();
		const iconMap = {
			critical: "realtimeEngines/critical_severity.png",
			high: "realtimeEngines/high_severity.png",
			medium: "realtimeEngines/medium_severity.png",
			low: "realtimeEngines/low_severity.png"
		};

		const iconFile = iconMap[severityLower] || "info_untoggle.png";
		return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/${iconFile}" width="10" height="11" style="vertical-align: -12px;"/>`;
	}

	public async dispose(): Promise<void> {
		await super.dispose();
		(this.scannerService as AscaScannerService).dispose();
		this.hoverProviderDisposable?.dispose();
	}
}
