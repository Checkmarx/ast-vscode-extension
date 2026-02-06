/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { IacScannerService } from "./iacScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { buildCommandButtons, renderCxAiBadge } from "../../../utils/utils";
import { MediaPathResolver } from "../../../utils/mediaPathResolver";
import { IacHoverData } from "../../common/types";
import { constants } from "../../../utils/common/constants";

export class IacScannerCommand extends BaseScannerCommand {
	constructor(
		context: vscode.ExtensionContext,
		logs: Logs,
		configManager: ConfigurationManager
	) {
		const scannerService = new IacScannerService();
		super(context, logs, scannerService.config, scannerService, configManager);
	}

	private hoverProviderDisposable: vscode.Disposable | undefined;

	protected async initializeScanner(): Promise<void> {
		const scanner = this.scannerService as IacScannerService;
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
		scanner: IacScannerService
	): vscode.Hover | undefined {
		const filePath = document.uri.fsPath;
		const line = position.line;
		const key = `${filePath}:${line}`;

		const hoverData = scanner.getHoverData().get(key);

		const diagnostics = scanner.getDiagnosticsMap().get(document.uri.fsPath) ?? [];
		const relevantDiagnostic = diagnostics.find(
			(d) => d.range.start.line === position.line &&
				position.character >= d.range.start.character &&
				position.character <= d.range.end.character
		);

		if (!hoverData || !relevantDiagnostic) {
			return;
		}

		return this.createHoverContent(hoverData);
	}

	private createHoverContent(hoverData: IacHoverData[]): vscode.Hover {
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

			md.appendMarkdown(this.renderSeverityIcon(problem.severity));
			md.appendMarkdown(this.renderID(problem));
			md.appendMarkdown(`${buttons}<br>`);
		});

		return new vscode.Hover(md);
	}

	private renderSeverityIcon(severity: string): string {
		const iconName = constants.ossIcons[severity.toLowerCase() as keyof typeof constants.ossIcons];
		if (!iconName) {
			return "";
		}
		const iconPath = MediaPathResolver.getMediaFilePath('icons', 'realtimeEngines', iconName);
		const iconUri = vscode.Uri.file(iconPath).toString();
		return `<img src="${iconUri}" width="15" height="16" style="vertical-align: -12px;" />`;
	}

	private renderID(hoverData: IacHoverData): string {
		return `
<b>${hoverData.title}</b> - ${hoverData.actualValue}. ${hoverData.description}
<i style="color: dimgrey;"> - IaC vulnerability<br></i>
`;
	}

	public async dispose(): Promise<void> {
		await super.dispose();
		this.scannerService.dispose();
		this.hoverProviderDisposable?.dispose();
	}

	public getScannerService(): IacScannerService {
		return this.scannerService as IacScannerService;
	}
}
