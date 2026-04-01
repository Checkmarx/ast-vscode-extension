import * as vscode from "vscode";
import { Logs } from "../../models/logs";
import { IScannerCommand, IScannerService, IScannerConfig } from "./types";
import { ConfigurationManager } from "../configuration/configurationManager";

export abstract class BaseScannerCommand implements IScannerCommand {
  protected context: vscode.ExtensionContext;
  protected logs: Logs;
  protected config: IScannerConfig;
  protected scannerService: IScannerService;
  protected onDidChangeTextDocument: vscode.Disposable | undefined;
  protected onDidOpenTextDocument: vscode.Disposable | undefined;
  protected configManager: ConfigurationManager;
  protected timeouts = new Map<string, NodeJS.Timeout>();
  protected pendingEvents = new Map<string, vscode.TextDocumentChangeEvent>();

  constructor(
    context: vscode.ExtensionContext,
    logs: Logs,
    config: IScannerConfig,
    scannerService: IScannerService,
    configManager: ConfigurationManager
  ) {
    this.context = context;
    this.logs = logs;
    this.config = config;
    this.scannerService = scannerService;
    this.configManager = configManager;
  }

  public async register(): Promise<void> {
    try {
      const isActive = this.configManager.isScannerActive(this.config);

      if (isActive) {
        this.logs.info(this.config.enabledMessage);
        await this.initializeScanner();
      } else {
        await this.dispose();
        this.logs.info(this.config.disabledMessage);
      }
    } catch (error) {
      console.error(error);
      this.logs.error(this.config.errorMessage);
    }
  }

  public async dispose(): Promise<void> {
    if (this.onDidChangeTextDocument) {
      this.onDidChangeTextDocument.dispose();
      this.context.subscriptions.push(this.onDidChangeTextDocument);
      this.onDidChangeTextDocument = undefined;
    }
    if (this.onDidOpenTextDocument) {
      this.onDidOpenTextDocument.dispose();
      this.context.subscriptions.push(this.onDidOpenTextDocument);
      this.onDidOpenTextDocument = undefined;
    }
    await this.scannerService.clearProblems();
  }

  protected registerScanOnFileOpen(): void {
    if (this.onDidOpenTextDocument) {
      this.onDidOpenTextDocument.dispose();
      this.onDidOpenTextDocument = undefined;
    }
    this.onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(
      (document) => {
        try {
          this.scannerService.scan(document, this.logs);
        } catch (error) {
          console.error(error);
        }
      }
    );
    this.context.subscriptions.push(this.onDidOpenTextDocument);
  }

  protected async initializeScanner(): Promise<void> {
    this.registerScanOnChangeText();
    this.registerScanOnFileOpen();
  }

  protected registerScanOnChangeText(): void {
    if (this.onDidChangeTextDocument) {
      this.onDidChangeTextDocument.dispose();
      this.onDidChangeTextDocument = undefined;
    }

    this.onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        const uri = event.document.uri.toString();

        if (event.contentChanges.length > 0) {
          this.pendingEvents.set(uri, event);
        }

        this.perDocumentDebounce((_) => {
          const pending = this.pendingEvents.get(uri);
          if (pending) {
            this.pendingEvents.delete(uri);
            this.onTextChange(pending);
          }
        }, 1000)(event);
      }
    );

    this.context.subscriptions.push(this.onDidChangeTextDocument);
  }

  protected onTextChange(event: vscode.TextDocumentChangeEvent): void {
    try {
      this.scannerService.scan(event.document, this.logs);
    } catch (error) {
      console.error(error);
      this.logs.warn(`Failed to scan using ${this.config.engineName}.`);
    }
  }

  protected perDocumentDebounce(func: (event: vscode.TextDocumentChangeEvent) => void, wait: number) {
    return (event: vscode.TextDocumentChangeEvent) => {
      try {
        const docUri = event.document.uri.toString();
        const existingTimeout = this.timeouts.get(docUri);

        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const later = () => {
          this.timeouts.delete(docUri);
          func.apply(this, [event]);
        };

        const timeout = setTimeout(later, wait);
        this.timeouts.set(docUri, timeout);
      } catch (error) {
        console.error(error);
      }
    };
  }
}
