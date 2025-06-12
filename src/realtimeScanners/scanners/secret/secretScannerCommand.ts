import * as vscode from "vscode";
import { Logs } from "../../../models/logs";
import { BaseScannerCommand } from "../../common/baseScannerCommand";
import { SecretScannerService } from "./secretScannerService";
import { ConfigurationManager } from "../../configuration/configurationManager";

export class SecretScannerCommand extends BaseScannerCommand {
	constructor(
		context: vscode.ExtensionContext,
		logs: Logs,
		configManager: ConfigurationManager
	) {
		const scannerService = new SecretScannerService();
		super(context, logs, scannerService.config, scannerService, configManager);
		this.debounceStrategy = "global";
	}

	protected async initializeScanner(): Promise<void> {
		this.registerScanOnChangeText();
	}

	public async dispose(): Promise<void> {
		await super.dispose();
		(this.scannerService as SecretScannerService).dispose();
	}
}
