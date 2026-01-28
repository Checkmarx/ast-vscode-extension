/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { AscaScannerService } from "./ascaScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { constants } from "../../../utils/common/constants";
import { buildCommandButtons, renderCxAiBadge } from "../../../utils/utils";
import { MediaPathResolver } from "../../../utils/mediaPathResolver";
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
		const scanner = this.scannerService as AscaScannerService;
		await super.initializeScanner();
		scanner.initializeScanner();

		if (this.hoverProviderDisposable) {
			this.hoverProviderDisposable.dispose();
		}

		this.hoverProviderDisposable = vscode.languages.registerHoverProvider(
			{ scheme: "file" },
			{ provideHover: (doc, pos) => this.getHover(doc, pos, scanner) }
		);
	}

	private getHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		scanner: AscaScannerService
	) {
		const key = `${document.uri.fsPath}:${position.line}`;
		const hoverData: AscaHoverData[] = scanner.getHoverData()?.get(key);
		const diagnostics = scanner.getDiagnosticsMap()?.get(document.uri.fsPath) || [];
		const hasDiagnostic = diagnostics.some(
			(d) => d.range.start.line === position.line
		);

		if (!hoverData || !hasDiagnostic) {
			return;
		}

		return this.createHoverContent(hoverData);
	}

	private createHoverContent(hoverData: AscaHoverData[]): vscode.Hover {
		const md = new vscode.MarkdownString();
		md.supportHtml = true;
		md.isTrusted = true;

		md.appendMarkdown(renderCxAiBadge() + "<br>");

		hoverData.forEach((problem, index) => {
			if (index > 0) {
				md.appendMarkdown("<br>");
			}

			const args = encodeURIComponent(JSON.stringify([problem]));
			const buttons = buildCommandButtons(args, false, false);

			md.appendMarkdown(this.renderSeverityIcon(problem.severity) + " ");
			md.appendMarkdown(this.renderID(problem) + "<br>");
			md.appendMarkdown(`${buttons}<br>`);
		});

		return new vscode.Hover(md);
	}

	private renderID(hoverData: AscaHoverData): string {
		return `<b>${hoverData.ruleName}</b> - ${hoverData.description} <i style="color: dimgrey;"> - SAST vulnerability<br></i>`;
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
		const iconPath = MediaPathResolver.getMediaFilePath('icons', iconFile);
		const iconUri = vscode.Uri.file(iconPath).toString();
		return `<img src="${iconUri}" width="15" height="16" style="vertical-align: -12px;"/>`;
	}

	public async dispose(): Promise<void> {
		await super.dispose();
		this.scannerService.dispose();
		this.hoverProviderDisposable?.dispose();
	}

	public getScannerService(): AscaScannerService {
		return this.scannerService as AscaScannerService;
	}
}
