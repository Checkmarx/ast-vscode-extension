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
  protected timeouts = new Map<string, NodeJS.Timeout>();
  protected configManager: ConfigurationManager;
  protected debounceStrategy: "per-document" | "global" = "per-document";

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
        // await this.registerScanOnChangeText();
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
    await this.scannerService.clearProblems();
  }
  
  protected abstract initializeScanner(): Promise<void>;
  
  protected registerScanOnChangeText(): void {
      if (this.onDidChangeTextDocument) {
        this.onDidChangeTextDocument.dispose();
        this.onDidChangeTextDocument = undefined;
  }
    this.onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
      this.debounce(this.onTextChange.bind(this), 1000)
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

  protected debounce(func: (event: vscode.TextDocumentChangeEvent) => void, wait: number) {
    if (this.debounceStrategy === "global") {
      return this.globalDebounce(func, wait);
    } else {
      return this.perDocumentDebounce(func, wait);
    }
  }
  protected globalDebounce(func: (event: vscode.TextDocumentChangeEvent) => void, wait: number) {
    let timeout: NodeJS.Timeout | null = null;
    
    return function(...args) {
      // Clear previous timeout
      if (timeout) {
        clearTimeout(timeout);
      }
      
      // Set new timeout
      timeout = setTimeout(() => {
        func.apply(this, args);
      }, wait);
    };
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
