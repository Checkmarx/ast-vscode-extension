/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { IacScannerService } from "./iacScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { buildCommandButtons, renderCxAiBadge } from "../../../utils/utils";
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
		this.registerScanOnChangeText();
		const scanner = this.scannerService as IacScannerService;
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
		scanner: IacScannerService
	): vscode.Hover | undefined {
		const filePath = document.uri.fsPath;
		const line = position.line;
		const key = `${filePath}:${line}`;

		const hoverData = scanner.getHoverData().get(key);

		const diagnostics = scanner.getDiagnosticsMap().get(document.uri.fsPath) ?? [];
		const hasDiagnostic = diagnostics.some(
			(d) => d.range.start.line === position.line
		);

		if (!hoverData || !hasDiagnostic) {
			return;
		}

		return this.createHoverContent(hoverData);
	}

	private createHoverContent(hoverData: IacHoverData): vscode.Hover {
		const md = new vscode.MarkdownString();
		md.supportHtml = true;
		md.isTrusted = true;
		const args = encodeURIComponent(JSON.stringify([hoverData]));
		const buttons = buildCommandButtons(args, true);

		md.appendMarkdown(renderCxAiBadge() + "<br>");
		md.appendMarkdown(this.renderSeverityIcon(hoverData.severity));
		md.appendMarkdown(this.renderID(hoverData));

		md.appendMarkdown(`${buttons}<br>`);

		return new vscode.Hover(md);
	}
	private renderSeverityIcon(severity: string): string {
		const iconName = constants.ossIcons[severity.toLowerCase() as keyof typeof constants.ossIcons];
		if (!iconName) {
			return "";
		}
		return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/realtimeEngines/${iconName}" width="15" height="16" style="vertical-align: -12px;" />`;
	}
	private renderID(hoverData: IacHoverData): string {
		return `
<b>${hoverData.title} - ${hoverData.description}</b>
<i style="color: dimgrey;"> -IaC vulnerability<br></i>
`;
	}

	public async dispose(): Promise<void> {
		await super.dispose();
		this.hoverProviderDisposable?.dispose();
	}
}
