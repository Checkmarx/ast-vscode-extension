import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { RemediationEntry } from './remediationFileManager';
import { Logs } from '../../models/logs';

/**
 * Service for generating comprehensive PDF reports with flowcharts and test cases
 */
export class ReportGenerationService {
  private static instance: ReportGenerationService;

  private constructor() { }

  public static getInstance(): ReportGenerationService {
    if (!ReportGenerationService.instance) {
      ReportGenerationService.instance = new ReportGenerationService();
    }
    return ReportGenerationService.instance;
  }

  /**
   * Generate comprehensive PDF report with flowchart and test cases
   */
  public async generateReport(remediation: RemediationEntry, logs: Logs): Promise<void> {
    try {
      logs.info('[Report Generation] Starting report generation...');

      // Show progress indicator
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating Report',
          cancellable: true,
        },
        async (progress, token) => {
          progress.report({ message: 'Analyzing code with Copilot...' });

          // Generate prompt for Copilot
          const prompt = await this.generatePrompt(remediation);

          try {
            // Call Copilot API to get flowchart and test cases
            const response = await this.callCopilotAPI(prompt, logs, token);

            if (token.isCancellationRequested) {
              return;
            }

            progress.report({ message: 'Generating PDF report...' });

            // Generate PDF report
            await this.createPDFReport(remediation, response, logs);

            vscode.window.showInformationMessage('Report generated successfully!');
          } catch (error) {
            logs.error(`[Report Generation] Error: ${error}`);
            vscode.window.showErrorMessage(`Failed to generate report: ${error}`);
          }
        }
      );
    } catch (error) {
      logs.error(`[Report Generation] Error: ${error}`);
      vscode.window.showErrorMessage(`Failed to generate report: ${error}`);
    }
  }

  /**
   * Read full file content
   */
  private async readFullFileContent(filePath: string): Promise<string> {
    try {
      const uri = vscode.Uri.file(filePath);
      const fileContent = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder().decode(fileContent);
    } catch (error) {
      return '';
    }
  }

  /**
   * Generate prompt for Copilot to create flowchart and test cases
   */
  private async generatePrompt(remediation: RemediationEntry): Promise<string> {
    // Read the full file content
    const fullFileContent = await this.readFullFileContent(remediation.filePath);

    const hasFullContent = fullFileContent.length > 0;
    const fileContext = hasFullContent ? `

Full File Content (for context):
\`\`\`
${fullFileContent}
\`\`\`
` : '';

    return `You are a security expert creating a comprehensive vulnerability remediation report.

**VULNERABILITY INFORMATION:**
- File: ${remediation.filePath}
- Lines: ${remediation.startLine}-${remediation.endLine}
- Severity: ${remediation.severity}
- Type: ${remediation.vulnerabilityType.toUpperCase()}
- Title: ${remediation.title}
${fileContext}

**Vulnerable Code:**
\`\`\`
${remediation.originalCode}
\`\`\`

**Fixed Code:**
\`\`\`
${remediation.fixedCode}
\`\`\`

Please provide a comprehensive analysis in the following format:

**MERMAID FLOWCHART (VULNERABLE):**
\`\`\`mermaid
graph TD
    Start([START]) --> A[EntryPoint: function_name]
    A --> B[Component1: function_name]
    B --> C["VulnerableComponent: function_name
Lines ${remediation.startLine}-${remediation.endLine}
⚠️ VULNERABILITY"]
    C --> D([VULNERABLE])
    
    style C fill:#ffcccc,stroke:#d73a4a,stroke-width:3px
\`\`\`

**MERMAID FLOWCHART (SECURE):**
\`\`\`mermaid
graph TD
    Start([START]) --> A[EntryPoint: function_name]
    A --> B[Component1: function_name]
    B --> C["FixedComponent: function_name
Lines ${remediation.startLine}-${remediation.endLine}
✓ SECURE"]
    C --> D([SECURE])
    
    style C fill:#ccffcc,stroke:#28a745,stroke-width:3px
\`\`\`

**MANUAL TEST CASES:**

Generate comprehensive manual test cases that cover:
1. **Positive Test Cases** - Verify the fix works correctly
2. **Negative Test Cases** - Verify the vulnerability is fixed
3. **Edge Cases** - Test boundary conditions
4. **Regression Tests** - Ensure no functionality is broken

Format each test case as:
### Test Case [Number]: [Title]
- **Objective:** [What this test verifies]
- **Preconditions:** [Setup required]
- **Test Steps:**
  1. [Step 1]
  2. [Step 2]
  3. [Step 3]
- **Expected Result:** [What should happen]
- **Actual Result:** [To be filled during testing]
- **Status:** [PASS/FAIL - To be filled]

Provide at least 5-10 comprehensive test cases covering all impacted functionality.`;
  }

  /**
   * Call Copilot API to get flowchart and test cases
   */
  private async callCopilotAPI(
    prompt: string,
    logs: Logs,
    token: vscode.CancellationToken
  ): Promise<string> {
    try {
      // Check if Language Model API is available
      if (!vscode.lm || typeof vscode.lm.selectChatModels !== 'function') {
        logs.info(`[Report Generation] Language Model API not available`);
        throw new Error('Copilot API not available');
      }

      logs.info(`[Report Generation] Selecting Copilot models...`);

      // Select Copilot models
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
      });

      if (models.length === 0) {
        logs.error(`[Report Generation] No Copilot models available`);
        throw new Error('No Copilot models available');
      }

      const model = models[0];
      logs.info(`[Report Generation] Using model: ${model.name}`);

      // Create chat messages
      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ];

      // Send request to Copilot
      logs.info(`[Report Generation] Sending request to Copilot...`);
      const response = await model.sendRequest(messages, {}, token);

      // Accumulate response
      let fullResponse = '';
      for await (const chunk of response.text) {
        fullResponse += chunk;
      }

      logs.info(`[Report Generation] Received response: ${fullResponse.length} characters`);
      return fullResponse;
    } catch (error) {
      logs.error(`[Report Generation] Copilot API error: ${error}`);
      throw error;
    }
  }

  /**
   * Create PDF report with flowchart and test cases
   */
  private async createPDFReport(
    remediation: RemediationEntry,
    aiResponse: string,
    logs: Logs
  ): Promise<void> {
    try {
      // Extract Mermaid diagrams
      const mermaidDiagrams = this.extractMermaidDiagrams(aiResponse);

      // Extract test cases
      const testCases = this.extractTestCases(aiResponse);

      // Generate HTML content for PDF
      const htmlContent = this.generateHTMLReport(remediation, mermaidDiagrams, testCases, aiResponse);

      // Save as HTML file (user can print to PDF from browser)
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      const reportFileName = `remediation-report-${remediation.id}.html`;
      const reportPath = path.join(workspaceFolder.uri.fsPath, reportFileName);

      fs.writeFileSync(reportPath, htmlContent, 'utf-8');

      logs.info(`[Report Generation] Report saved to: ${reportPath}`);

      // Open the report in browser
      const openReport = 'Open Report';
      const printToPDF = 'Print to PDF';
      const choice = await vscode.window.showInformationMessage(
        `Report generated successfully! Saved to: ${reportFileName}`,
        openReport,
        printToPDF
      );

      if (choice === openReport) {
        await vscode.env.openExternal(vscode.Uri.file(reportPath));
      } else if (choice === printToPDF) {
        await vscode.env.openExternal(vscode.Uri.file(reportPath));
        vscode.window.showInformationMessage('Use your browser\'s Print function (Ctrl+P) and select "Save as PDF"');
      }
    } catch (error) {
      logs.error(`[Report Generation] Error creating PDF: ${error}`);
      throw error;
    }
  }

  /**
   * Extract Mermaid diagrams from AI response
   */
  private extractMermaidDiagrams(response: string): { vulnerable: string; secure: string } {
    const vulnerableMermaidMatch = response.match(/\*\*MERMAID FLOWCHART \(VULNERABLE\):\*\*\s*```mermaid\s*([\s\S]*?)```/i);
    const secureMermaidMatch = response.match(/\*\*MERMAID FLOWCHART \(SECURE\):\*\*\s*```mermaid\s*([\s\S]*?)```/i);

    return {
      vulnerable: vulnerableMermaidMatch ? vulnerableMermaidMatch[1].trim() : '',
      secure: secureMermaidMatch ? secureMermaidMatch[1].trim() : ''
    };
  }

  /**
   * Extract test cases from AI response
   */
  private extractTestCases(response: string): string {
    const testCasesMatch = response.match(/\*\*MANUAL TEST CASES:\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
    return testCasesMatch ? testCasesMatch[1].trim() : response;
  }

  /**
   * Generate HTML report with Mermaid diagrams and test cases
   */
  private generateHTMLReport(
    remediation: RemediationEntry,
    mermaidDiagrams: { vulnerable: string; secure: string },
    testCases: string,
    fullResponse: string
  ): string {
    const escapeHtml = (text: string) => {
      const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"'`]/g, (m) => map[m]);
    };

    // Convert markdown-style test cases to HTML
    const testCasesHTML = testCases
      .replace(/### (Test Case \d+:.*)/g, '<h3>$1</h3>')
      .replace(/\*\*(.*?):\*\*/g, '<strong>$1:</strong>')
      .replace(/- (.*)/g, '<li>$1</li>')
      .replace(/(\d+)\. (.*)/g, '<li>$2</li>');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vulnerability Remediation Report - ${escapeHtml(remediation.title)}</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script>
        mermaid.initialize({
            startOnLoad: true,
            theme: 'default',
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });
    </script>
    <style>
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
            .page-break { page-break-before: always; }
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }

        .report-container {
            background: white;
            padding: 40px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }

        .header {
            border-bottom: 3px solid #0066cc;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        .header h1 {
            color: #0066cc;
            margin: 0 0 10px 0;
        }

        .metadata {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            margin-top: 15px;
        }

        .badge {
            padding: 5px 12px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 12px;
        }

        .badge.critical { background: #d73a4a; color: white; }
        .badge.high { background: #ff6b6b; color: white; }
        .badge.medium { background: #ffa500; color: white; }
        .badge.low { background: #ffd700; color: #333; }
        .badge.info { background: #17a2b8; color: white; }

        .section {
            margin: 30px 0;
        }

        .section-title {
            font-size: 24px;
            color: #0066cc;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }

        .flowchart-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin: 20px 0;
        }

        .flowchart-column {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            background: #fafafa;
        }

        .flowchart-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 4px;
        }

        .flowchart-title.vulnerable {
            background: #ffebee;
            color: #c62828;
        }

        .flowchart-title.secure {
            background: #e8f5e9;
            color: #2e7d32;
        }

        .code-block {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            margin: 10px 0;
            overflow-x: auto;
        }

        .code-block pre {
            margin: 0;
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }

        .test-cases {
            margin-top: 20px;
        }

        .test-cases h3 {
            color: #0066cc;
            margin-top: 25px;
        }

        .test-cases ul {
            list-style-type: none;
            padding-left: 0;
        }

        .test-cases li {
            margin: 8px 0;
            padding-left: 20px;
        }

        .print-button {
            background: #0066cc;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 20px 0;
        }

        .print-button:hover {
            background: #0052a3;
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="header">
            <h1>🔒 Vulnerability Remediation Report</h1>
            <div class="metadata">
                <span class="badge ${remediation.severity.toLowerCase()}">${escapeHtml(remediation.severity)}</span>
                <span><strong>Type:</strong> ${remediation.vulnerabilityType.toUpperCase()}</span>
                <span><strong>File:</strong> ${escapeHtml(remediation.filePath)}</span>
                <span><strong>Lines:</strong> ${remediation.startLine}-${remediation.endLine}</span>
                <span><strong>Date:</strong> ${new Date(remediation.timestamp).toLocaleString()}</span>
            </div>
        </div>

        <button class="print-button no-print" onclick="window.print()">🖨️ Print to PDF</button>

        <div class="section">
            <h2 class="section-title">📋 Vulnerability Details</h2>
            <p><strong>Title:</strong> ${escapeHtml(remediation.title)}</p>
            <p><strong>Description:</strong> ${escapeHtml(remediation.description)}</p>
        </div>

        <div class="section">
            <h2 class="section-title">📊 Execution Flow Diagrams</h2>
            <div class="flowchart-container">
                <div class="flowchart-column">
                    <div class="flowchart-title vulnerable">🔴 Vulnerable Execution Flow</div>
                    ${mermaidDiagrams.vulnerable ? `
                        <div class="mermaid">
                            ${mermaidDiagrams.vulnerable}
                        </div>
                    ` : '<p>No flowchart available</p>'}
                </div>

                <div class="flowchart-column">
                    <div class="flowchart-title secure">🟢 Secure Execution Flow</div>
                    ${mermaidDiagrams.secure ? `
                        <div class="mermaid">
                            ${mermaidDiagrams.secure}
                        </div>
                    ` : '<p>No flowchart available</p>'}
                </div>
            </div>
        </div>

        <div class="section page-break">
            <h2 class="section-title">💻 Code Changes</h2>
            <h3>Vulnerable Code (Before Fix)</h3>
            <div class="code-block">
                <pre>${escapeHtml(remediation.originalCode)}</pre>
            </div>

            <h3>Fixed Code (After Fix)</h3>
            <div class="code-block">
                <pre>${escapeHtml(remediation.fixedCode)}</pre>
            </div>
        </div>

        <div class="section page-break">
            <h2 class="section-title">🧪 Manual Test Cases</h2>
            <div class="test-cases">
                ${testCasesHTML}
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">📝 Full Analysis</h2>
            <div class="code-block">
                <pre>${escapeHtml(fullResponse)}</pre>
            </div>
        </div>

        <div class="section">
            <p style="text-align: center; color: #666; margin-top: 40px;">
                Generated by Checkmarx VSCode Extension on ${new Date().toLocaleString()}
            </p>
        </div>
    </div>
</body>
</html>`;
  }
}