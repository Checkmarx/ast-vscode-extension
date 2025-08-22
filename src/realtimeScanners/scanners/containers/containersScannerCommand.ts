/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { ContainersScannerService } from "./containersScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";
import { constants } from "../../../utils/common/constants";
import { CxRealtimeEngineStatus } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/oss/CxRealtimeEngineStatus";
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

		const diagnostics = scanner.getDiagnosticsMap().get(document.uri.fsPath) ?? [];
		const hasDiagnostic = diagnostics.some(
			(d) => d.range.start.line === position.line
		);

		if (!hoverData || !hasDiagnostic) {
			return;
		}

		return this.createHoverContent(hoverData);
	}

	private createHoverContent(hoverData: ContainersHoverData): vscode.Hover {
		const md = new vscode.MarkdownString();
		md.supportHtml = true;
		md.isTrusted = true;
		const { vulnerabilities, ...hoverDataWithoutVuln } = hoverData;
		const args = encodeURIComponent(JSON.stringify([hoverDataWithoutVuln]));
		const buttons = buildCommandButtons(args, true, false);
		const isVulnerable = this.isVulnerableStatus(hoverData.status);
		const isMalicious = hoverData.status === "Malicious";

		md.appendMarkdown(renderCxAiBadge() + "<br>");
		if (isVulnerable) {
			md.appendMarkdown(this.renderImageIcon());
		}
		if (isMalicious) {
			md.appendMarkdown(this.renderMaliciousIcon());
		}
		md.appendMarkdown(this.renderID(hoverData));
		if (isVulnerable) {
			md.appendMarkdown(this.renderVulnCounts(hoverData.vulnerabilities || []));
		}
		md.appendMarkdown(`${buttons}<br>`);

		return new vscode.Hover(md);
	}

	private renderID(hoverData: ContainersHoverData): string {
		if (hoverData.status == CxRealtimeEngineStatus.malicious) {
			return `
<b>${hoverData.imageName}:${hoverData.imageTag}</b>
<i style="color: dimgrey;"> - ${hoverData.status} image <br></i>
`;
		}
		return `
<b>${hoverData.imageName}:${hoverData.imageTag}</b>
<i style="color: dimgrey;"> - ${hoverData.status} severity image <br></i>
`;
	}

	private renderImageIcon(): string {
		return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/realtimeEngines/container_image.png" width="15" height="16" style="vertical-align: -12px;"/>`;
	}

	private isVulnerableStatus(status: string): boolean {
		return [
			CxRealtimeEngineStatus.critical,
			CxRealtimeEngineStatus.high,
			CxRealtimeEngineStatus.medium,
			CxRealtimeEngineStatus.low,
		].includes(status as any);
	}

	private renderMaliciousFinding(): string {
		return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/maliciousFindig.png" style="vertical-align: -12px;" />`;
	}

	private renderMaliciousIcon(): string {
		return `<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/malicious.png" width="10" height="11" style="vertical-align: -12px;"/>`;
	}

	private renderVulnCounts(vulnerabilities: Array<{ severity: string }>): string {
		const counts = { critical: 0, high: 0, medium: 0, low: 0 };
		for (const v of vulnerabilities) {
			const sev = v.severity.toLowerCase();
			if (counts[sev as keyof typeof counts] !== undefined) {
				counts[sev as keyof typeof counts]++;
			}
		}

		const severityDisplayItems = Object.entries(counts)
			.filter(([_, count]) => count > 0)
			.map(
				([sev, count]) =>
					`<img src="https://raw.githubusercontent.com/Checkmarx/ast-vscode-extension/main/media/icons/realtimeEngines/${constants.ossIcons[sev as keyof typeof constants.ossIcons]
					}" width="10" height="11" style="vertical-align: -12px;"/> ${count} &nbsp; `
			);

		return `${severityDisplayItems.join("")}\n\n\n`;
	}

	public dispose(): Promise<void> {
		if (this.hoverProviderDisposable) {
			this.hoverProviderDisposable.dispose();
		}
		return super.dispose();
	}

	public getScannerService(): ContainersScannerService {
		return this.scannerService as ContainersScannerService;
	}
}
