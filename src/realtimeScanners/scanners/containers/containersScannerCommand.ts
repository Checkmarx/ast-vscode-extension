/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { ContainersScannerService } from "./containersScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { constants } from "../../../utils/common/constants";
import { buildCommandButtons, renderCxAiBadge } from "../../../utils/utils";
import { ContainersHoverData } from "../../common/types";

export class ContainersScannerCommand extends BaseScannerCommand {
	constructor(
		context: vscode.ExtensionContext,
		logs: Logs,
		configManager: ConfigurationManager
	) {
		const scannerService = new ContainersScannerService();
		super(context, logs, scannerService.config, scannerService, configManager);
	}

	private hoverProviderDisposable: vscode.Disposable | undefined;

	protected async initializeScanner(): Promise<void> {
		this.registerScanOnChangeText();
		const scanner = this.scannerService as ContainersScannerService;
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
		scanner: ContainersScannerService
	): vscode.Hover | undefined {
		const filePath = document.uri.fsPath;
		const line = position.line;
		const key = `${filePath}:${line}`;

		const hoverData = scanner.getHoverData().get(key);
		if (!hoverData) {
			return undefined;
		}

		return this.createHoverContent(hoverData);
	}

	private createHoverContent(hoverData: ContainersHoverData): vscode.Hover {
		const markdown = new vscode.MarkdownString();
		markdown.isTrusted = true;

		const vulnerabilityCount = hoverData.vulnerabilities.length;
		const statusIcon = hoverData.status === "Malicious" ? "🚨" : "ℹ️";

		markdown.appendMarkdown(`### ${statusIcon} Container Image Analysis\n\n`);
		markdown.appendMarkdown(`**Image:** \`${hoverData.imageName}:${hoverData.imageTag}\`\n\n`);
		markdown.appendMarkdown(`**Status:** ${hoverData.status}\n\n`);
		markdown.appendMarkdown(`**Vulnerabilities Found:** ${vulnerabilityCount}\n\n`);

		if (vulnerabilityCount > 0) {
			markdown.appendMarkdown(`### Vulnerabilities:\n\n`);

			const severityGroups: { [key: string]: string[] } = {};
			hoverData.vulnerabilities.forEach(vuln => {
				const severity = vuln.severity.toUpperCase();
				if (!severityGroups[severity]) {
					severityGroups[severity] = [];
				}
				severityGroups[severity].push(vuln.cve);
			});

			const severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
			severityOrder.forEach(severity => {
				if (severityGroups[severity]) {
					const severityIcon = this.getSeverityIcon(severity);
					markdown.appendMarkdown(`**${severityIcon} ${severity}:** ${severityGroups[severity].join(", ")}\n\n`);
				}
			});
		}

		markdown.appendMarkdown(`---\n\n`);
		markdown.appendMarkdown(renderCxAiBadge());

		const args = encodeURIComponent(JSON.stringify([hoverData]));
		const buttons = buildCommandButtons(args, false, false);

		if (buttons) {
			markdown.appendMarkdown(buttons);
		}

		return new vscode.Hover(markdown);
	}

	private getSeverityIcon(severity: string): string {
		switch (severity.toUpperCase()) {
			case "CRITICAL":
				return "🔴";
			case "HIGH":
				return "🟠";
			case "MEDIUM":
				return "🟡";
			case "LOW":
				return "🔵";
			default:
				return "⚪";
		}
	}

	public dispose(): Promise<void> {
		if (this.hoverProviderDisposable) {
			this.hoverProviderDisposable.dispose();
		}
		return super.dispose();
	}
}
