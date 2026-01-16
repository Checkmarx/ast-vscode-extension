import * as vscode from "vscode";
import { AscaHoverData, SecretsHoverData, IacHoverData } from "../realtimeScanners/common/types";
import { UnifiedRemediationService, ScannerType } from "./unifiedRemediationService";

/**
 * Type for hover data from any scanner
 */
type AnyHoverData = AscaHoverData | SecretsHoverData | IacHoverData;

/**
 * Interface for unified remediation diff data
 */
interface UnifiedRemediationDiffData {
  scannerType: ScannerType;
  title: string;
  severity: string;
  originalCode: string;
  fixedCode: string;
  lineNumber: number;
  filePath: string;
  language: string;
}

/**
 * Unified provider for showing remediation diffs for all scanner types
 */
export class UnifiedRemediationDiffProvider {
  private beforeProvider: vscode.Disposable | undefined;
  private afterProvider: vscode.Disposable | undefined;
  private currentDiffData: UnifiedRemediationDiffData | undefined;
  private remediationService: UnifiedRemediationService;

  constructor(private context: vscode.ExtensionContext) {
    this.remediationService = new UnifiedRemediationService();
  }

  /**
   * Show diff editor for any scanner type remediation
   */
  async showDiff(hoverData: AnyHoverData): Promise<void> {
    try {
      // Determine scanner type from hover data structure
      const scannerType = this.detectScannerType(hoverData);

      // Show progress while preparing diff
      const diffData = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Preparing ${scannerType} remediation preview...`,
          cancellable: false
        },
        async (progress) => {
          progress.report({ message: "Fetching AI-generated fix..." });
          return await this.prepareDiffData(hoverData, scannerType);
        }
      );

      if (!diffData) {
        vscode.window.showErrorMessage("Unable to prepare remediation preview");
        return;
      }

      this.currentDiffData = diffData;

      // Create virtual URIs for before and after
      const beforeUri = vscode.Uri.parse(
        `checkmarx-before:///${diffData.filePath}#L${diffData.lineNumber}`
      );
      const afterUri = vscode.Uri.parse(
        `checkmarx-after:///${diffData.filePath}#L${diffData.lineNumber}`
      );

      // Dispose previous providers if they exist
      this.disposeProviders();

      // Register content providers
      this.beforeProvider = vscode.workspace.registerTextDocumentContentProvider(
        "checkmarx-before",
        {
          provideTextDocumentContent: (uri: vscode.Uri) => {
            return this.currentDiffData?.originalCode || "";
          },
        }
      );

      this.afterProvider = vscode.workspace.registerTextDocumentContentProvider(
        "checkmarx-after",
        {
          provideTextDocumentContent: (uri: vscode.Uri) => {
            return this.currentDiffData?.fixedCode || "";
          },
        }
      );

      // Open diff editor
      await vscode.commands.executeCommand(
        "vscode.diff",
        beforeUri,
        afterUri,
        `🔒 ${diffData.title} (${diffData.severity})`,
        {
          preview: true,
          viewColumn: vscode.ViewColumn.Beside,
          preserveFocus: false,
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to show remediation preview: ${error.message}`
      );
      console.error('[UnifiedRemediationDiffProvider] Error:', error);
    }
  }

  /**
   * Detect scanner type from hover data structure
   */
  private detectScannerType(hoverData: AnyHoverData): ScannerType {
    if ('ruleName' in hoverData && 'remediationAdvise' in hoverData) {
      return ScannerType.Asca;
    } else if ('title' in hoverData && 'secretValue' in hoverData) {
      return ScannerType.Secrets;
    } else if ('expectedValue' in hoverData && 'actualValue' in hoverData) {
      return ScannerType.Iac;
    }
    throw new Error('Unknown scanner type from hover data');
  }

  /**
   * Prepare diff data from any scanner type
   */
  private async prepareDiffData(
    hoverData: AnyHoverData,
    scannerType: ScannerType
  ): Promise<UnifiedRemediationDiffData | undefined> {
    // Get file path and line number based on scanner type
    const { filePath, lineNumber } = this.extractFileInfo(hoverData);

    if (!filePath) {
      vscode.window.showErrorMessage('Unable to determine file path for remediation preview');
      return undefined;
    }

    // Open the document
    const document = await vscode.workspace.openTextDocument(filePath);

    // Get the original code with context
    const originalCode = this.getOriginalCode(document, lineNumber);

    // Detect language from file extension
    const language = this.detectLanguage(filePath);

    // Get the fixed code using unified remediation service
    const fixedCode = await this.getFixedCode(originalCode, hoverData, scannerType, language, lineNumber);

    // Get title based on scanner type
    const title = this.getTitle(hoverData, scannerType);
    const severity = this.getSeverity(hoverData);

    return {
      scannerType,
      title,
      severity,
      originalCode,
      fixedCode,
      lineNumber,
      filePath,
      language
    };
  }

  /**
   * Extract file path and line number from hover data
   */
  private extractFileInfo(hoverData: AnyHoverData): { filePath: string; lineNumber: number } {
    // For IaC, use originalFilePath instead of filePath (which points to temp directory)
    if ('originalFilePath' in hoverData && hoverData.originalFilePath) {
      const lineNumber = hoverData.location?.line ?? 0;
      console.log('[UnifiedRemediationDiffProvider] Using originalFilePath for IaC:', hoverData.originalFilePath);
      return { filePath: hoverData.originalFilePath, lineNumber };
    }

    // For other scanners, use filePath
    if ('filePath' in hoverData && hoverData.filePath) {
      const lineNumber = hoverData.location?.line ?? 0;
      // Check if this is a temp file path (contains scanner temp directory)
      const isTempFile = hoverData.filePath.includes('Cx-iac-realtime-scanner') ||
        hoverData.filePath.includes('Cx-asca-realtime-scanner') ||
        hoverData.filePath.includes('Cx-secrets-realtime-scanner') ||
        hoverData.filePath.includes('Cx-oss-realtime-scanner') ||
        hoverData.filePath.includes('Cx-containers-realtime-scanner');

      if (isTempFile) {
        console.warn('[UnifiedRemediationDiffProvider] Detected temp file path, falling back to active editor:', hoverData.filePath);
        // Fallback to active editor if we detect a temp file
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
          const lineNumber = activeEditor.selection.active.line;
          return { filePath: activeEditor.document.uri.fsPath, lineNumber };
        }
      } else {
        return { filePath: hoverData.filePath, lineNumber };
      }
    }

    // Fallback: try to get from active editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      const lineNumber = activeEditor.selection.active.line;
      console.log('[UnifiedRemediationDiffProvider] Using active editor file path:', activeEditor.document.uri.fsPath);
      return { filePath: activeEditor.document.uri.fsPath, lineNumber };
    }

    return { filePath: '', lineNumber: 0 };
  }

  /**
   * Get original code with context lines
   */
  private getOriginalCode(document: vscode.TextDocument, lineNumber: number): string {
    const contextLines = 5; // Show 5 lines before and after

    const startLine = Math.max(0, lineNumber - contextLines);
    const endLine = Math.min(
      document.lineCount - 1,
      lineNumber + contextLines
    );

    let code = "";
    for (let i = startLine; i <= endLine; i++) {
      code += document.lineAt(i).text + "\n";
    }

    return code.trimEnd();
  }

  /**
   * Detect programming language from file path
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const languageMap: { [key: string]: string } = {
      'py': 'python',
      'js': 'javascript',
      'ts': 'typescript',
      'java': 'java',
      'cs': 'csharp',
      'go': 'go',
      'rb': 'ruby',
      'php': 'php',
      'cpp': 'cpp',
      'c': 'c',
      'yaml': 'yaml',
      'yml': 'yaml',
      'json': 'json',
      'tf': 'terraform',
      'dockerfile': 'dockerfile'
    };
    return languageMap[ext] || ext;
  }

  /**
   * Get fixed code using unified remediation service
   */
  private async getFixedCode(
    originalCode: string,
    hoverData: AnyHoverData,
    scannerType: ScannerType,
    language: string,
    lineNumber: number
  ): Promise<string> {
    try {
      // Use unified remediation service to get the fix
      const remediation = await this.remediationService.getRemediationCode({
        scannerType,
        hoverData,
        vulnerableCode: originalCode,
        language,
        lineNumber
      });

      // If remediation is empty or just whitespace, return original with comment
      if (!remediation || remediation.trim().length === 0) {
        return this.addRemediationComment(originalCode, 'No remediation available', language);
      }

      return remediation;
    } catch (error) {
      console.error('[UnifiedRemediationDiffProvider] Error getting fixed code:', error);
      return this.addRemediationComment(originalCode, `Error: ${error.message}`, language);
    }
  }

  /**
   * Add remediation comment to code
   */
  private addRemediationComment(code: string, message: string, language: string): string {
    const commentPrefix = this.getCommentPrefix(language);
    const lines = code.split('\n');
    const indent = lines[0]?.match(/^\s*/)?.[0] || '';

    const comment = [
      `${indent}${commentPrefix} ═══════════════════════════════════════════════════`,
      `${indent}${commentPrefix} Checkmarx Remediation`,
      `${indent}${commentPrefix} ${message}`,
      `${indent}${commentPrefix} ═══════════════════════════════════════════════════`,
      ''
    ].join('\n');

    return comment + code;
  }

  /**
   * Get comment prefix for language
   */
  private getCommentPrefix(language: string): string {
    const pythonLike = ['python', 'ruby', 'yaml', 'terraform'];
    return pythonLike.includes(language) ? '#' : '//';
  }

  /**
   * Get title from hover data
   */
  private getTitle(hoverData: AnyHoverData, scannerType: ScannerType): string {
    if (scannerType === ScannerType.Asca && 'ruleName' in hoverData) {
      return `ASCA: ${hoverData.ruleName}`;
    } else if (scannerType === ScannerType.Secrets && 'title' in hoverData) {
      return `Secret: ${hoverData.title}`;
    } else if (scannerType === ScannerType.Iac && 'title' in hoverData) {
      return `IaC: ${hoverData.title}`;
    }
    return 'Remediation';
  }

  /**
   * Get severity from hover data
   */
  private getSeverity(hoverData: AnyHoverData): string {
    if ('severity' in hoverData) {
      return hoverData.severity;
    }
    return 'Unknown';
  }

  /**
   * Dispose content providers
   */
  private disposeProviders(): void {
    this.beforeProvider?.dispose();
    this.afterProvider?.dispose();
    this.beforeProvider = undefined;
    this.afterProvider = undefined;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.disposeProviders();
  }
}

