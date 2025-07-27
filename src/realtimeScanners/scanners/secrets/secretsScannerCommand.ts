/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { SecretsScannerService } from "./secretsScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { constants } from "../../../utils/common/constants";
import { buildCommandButtons, renderCxAiBadge } from "../../../utils/utils";
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
		this.registerScanOnChangeText();
		const scanner = this.scannerService as SecretsScannerService;
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
		scanner: SecretsScannerService
	) {
		const key = `${document.uri.fsPath}:${position.line}`;
		
		const hoverData: SecretsHoverData = scanner.getHoverData().get(key);

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
		const args = encodeURIComponent(JSON.stringify([hoverData]));

		const buttons = buildCommandButtons(args, false);

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
		return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/realtimeEngines/${iconName}" width="15" height="16" style="vertical-align: -12px;" />`;
	}


	public async dispose(): Promise<void> {
		await super.dispose();
		(this.scannerService as SecretsScannerService).dispose();
		this.hoverProviderDisposable?.dispose();
	}

	getScannerService(): SecretsScannerService {
		return this.scannerService as SecretsScannerService;
	}
}
