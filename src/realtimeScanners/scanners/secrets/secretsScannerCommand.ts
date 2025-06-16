/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { SecretsScannerService } from "./secretsScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { constants } from "../../../utils/common/constants";

export class SecretsScannerCommand extends BaseScannerCommand {
	constructor(
		context: vscode.ExtensionContext,
		logs: Logs,
		configManager: ConfigurationManager
	) {
		const scannerService = new SecretsScannerService();
		super(context, logs, scannerService.config, scannerService, configManager);
		this.debounceStrategy = "global";
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

	}



	private getHover(
		document: vscode.TextDocument,
		position: vscode.Position,
		scanner: any
	) {
		const key = `${document.uri.fsPath}:${position.line}`;
		const diagnostics = scanner.diagnosticsMap?.get(document.uri.fsPath) || [];
		const hasDiagnostic = diagnostics.some(
			(d) => d.range.start.line === position.line
		);

		if (!hasDiagnostic) {
			return;
		}
		const hoverData = scanner.secretsHoverData.get(key);
		const md = new vscode.MarkdownString();
		md.supportHtml = true;
		md.isTrusted = true;


		const buttons = `[ Fix with Cx & Copilot](command:cx.fixInChat)  [ View Cx Package Details](command:cx.viewDetails)  [ Ignore Cx Package](command:cx.ignore)`;


		md.appendMarkdown(`${hoverData.description}\n\n`);
		md.appendMarkdown(this.renderSecretsIcon() + "<br>");
		md.appendMarkdown(this.badge("Secrets") + "<br>");

		md.appendMarkdown(`${"&nbsp;".repeat(45)}${buttons}<br>`);
		md.appendMarkdown(this.renderSeverityIcon(hoverData.severity));

		return new vscode.Hover(md);
	}

	private badge(text: string): string {
		return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/CxAi.png"  style="vertical-align: -12px;"/>`;
	}

	private renderSecretsIcon(): string {
		return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/Itay/newSecretsCards/media/icons/secretsFinding.png" style="vertical-align: -12px;" />`;
	}

	private renderSeverityIcon(severity: string): string {
		const iconName = constants.ossIcons[severity.toLowerCase() as keyof typeof constants.ossIcons];
		if (!iconName) {
			return "";
		}
		return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/${iconName}" width="10" height="11" style="vertical-align: -12px;" />`;
	}


	public async dispose(): Promise<void> {
		await super.dispose();
		(this.scannerService as SecretsScannerService).dispose();
		this.hoverProviderDisposable?.dispose();
	}
}
