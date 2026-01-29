/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { SecretsScannerService } from "./secretsScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { constants } from "../../../utils/common/constants";
import { buildCommandButtons, renderCxAiBadge } from "../../../utils/utils";
import { MediaPathResolver } from "../../../utils/mediaPathResolver";
import { SecretsHoverData } from "../../common/types";


export class SecretsScannerCommand extends BaseScannerCommand {
	constructor(
		context: vscode.ExtensionContext,
		logs: Logs,
		configManager: ConfigurationManager
	) {
		const scannerService = new SecretsScannerService();
		super(context, logs, scannerService.config, scannerService, configManager);
	}

	private hoverProviderDisposable: vscode.Disposable | undefined;

	protected async initializeScanner(): Promise<void> {
		const scanner = this.scannerService as SecretsScannerService;
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
		scanner: SecretsScannerService
	) {
		const key = `${document.uri.fsPath}:${position.line}`;

		const hoverData: SecretsHoverData = scanner.getHoverData().get(key);

		const diagnostics = scanner.getDiagnosticsMap()?.get(document.uri.fsPath) || [];
		const relevantDiagnostic = diagnostics.find(
			(d) => d.range.start.line === position.line &&
				position.character >= d.range.start.character &&
				position.character <= d.range.end.character
		);

		if (!hoverData || !relevantDiagnostic) {
			return;
		}
		const md = new vscode.MarkdownString();
		md.supportHtml = true;
		md.isTrusted = true;
		const args = encodeURIComponent(JSON.stringify([hoverData]));

		const buttons = buildCommandButtons(args, false, true);

		md.appendMarkdown(renderCxAiBadge() + "<br>");
		md.appendMarkdown(this.renderSeverityIcon(hoverData.severity));
		md.appendMarkdown(this.renderID(hoverData));

		md.appendMarkdown(`${buttons}<br>`);

		return new vscode.Hover(md);
	}

	private renderID(hoverData: SecretsHoverData): string {
		return `
<b>${hoverData.title}</b>
<i style="color: dimgrey;"> - Secret finding <br></i>
`;
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


	public async dispose(): Promise<void> {
		await super.dispose();
		this.scannerService.dispose();
		this.hoverProviderDisposable?.dispose();
	}

	getScannerService(): SecretsScannerService {
		return this.scannerService as SecretsScannerService;
	}
}
