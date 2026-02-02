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
          progress.report({ message: 'Analyzing code with Checkmarx AI...' });

          // Generate prompt for AI analysis
          const prompt = await this.generatePrompt(remediation);

          try {
            // Call AI API to get flowchart and test cases
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
   * Generate bulk report for multiple remediations
   */
  public async generateBulkReport(remediations: RemediationEntry[], logs: Logs): Promise<void> {
    try {
      logs.info(`[Bulk Report Generation] Starting bulk report generation for ${remediations.length} vulnerabilities...`);

      if (remediations.length === 0) {
        vscode.window.showWarningMessage('No vulnerabilities selected for report generation');
        return;
      }

      // Show progress indicator
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Generating Report for ${remediations.length} Vulnerabilities`,
          cancellable: true,
        },
        async (progress, token) => {
          progress.report({ message: 'Analyzing all vulnerabilities in parallel...' });

          // Process all remediations in parallel for faster execution
          const processingPromises = remediations.map(async (remediation, index) => {
            if (token.isCancellationRequested) {
              return null;
            }

            try {
              logs.info(`[Bulk Report] Processing ${index + 1}/${remediations.length}: ${remediation.title}`);

              // Generate prompt for this remediation
              const prompt = await this.generatePrompt(remediation);

              // Call AI API
              const response = await this.callCopilotAPI(prompt, logs, token);

              if (token.isCancellationRequested) {
                return null;
              }

              // Extract data
              const mermaidDiagrams = this.extractMermaidDiagrams(response);
              const testCases = this.extractTestCases(response);

              // Log extraction results
              logs.info(`[Bulk Report] Extraction results for ${remediation.title}:`);
              logs.info(`[Bulk Report]   - Vulnerable flowchart: ${mermaidDiagrams.vulnerable ? 'Found (' + mermaidDiagrams.vulnerable.length + ' chars)' : 'NOT FOUND'}`);
              logs.info(`[Bulk Report]   - Secure flowchart: ${mermaidDiagrams.secure ? 'Found (' + mermaidDiagrams.secure.length + ' chars)' : 'NOT FOUND'}`);
              logs.info(`[Bulk Report]   - Test cases: ${testCases ? 'Found (' + testCases.length + ' chars)' : 'NOT FOUND'}`);

              if (!mermaidDiagrams.vulnerable || !mermaidDiagrams.secure) {
                logs.info(`[Bulk Report] Response preview (first 500 chars): ${response.substring(0, 500)}`);
              }

              logs.info(`[Bulk Report] Completed ${index + 1}/${remediations.length}: ${remediation.title}`);

              return {
                remediation,
                mermaidDiagrams,
                testCases,
                fullResponse: response
              };
            } catch (error) {
              logs.error(`[Bulk Report] Error processing ${remediation.title}: ${error}`);
              // Return null for failed items, we'll filter them out
              return null;
            }
          });

          // Wait for all processing to complete
          const results = await Promise.all(processingPromises);

          // Filter out null results (failed or cancelled items)
          const allReportData = results.filter(r => r !== null) as Array<{
            remediation: RemediationEntry;
            mermaidDiagrams: { vulnerable: string; secure: string };
            testCases: string;
            fullResponse: string;
          }>;

          if (token.isCancellationRequested) {
            return;
          }

          progress.report({ message: 'Generating combined PDF report...' });

          // Generate combined HTML report
          await this.createBulkPDFReport(allReportData, logs);
        }
      );
    } catch (error) {
      logs.error(`[Bulk Report Generation] Error: ${error}`);
      vscode.window.showErrorMessage(`Failed to generate bulk report: ${error}`);
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
   * Get test case guidance specific to vulnerability type
   */
  private getTestCaseGuidance(vulnerabilityType: string): string {
    switch (vulnerabilityType.toLowerCase()) {
      case 'asca':
        return `Generate comprehensive manual test cases for this ASCA (Application Security Configuration Analysis) vulnerability that cover:
1. **Configuration Validation Tests** - Verify the secure configuration is applied correctly
2. **Security Control Tests** - Verify security controls are functioning as expected
3. **Negative Tests** - Verify insecure configurations are rejected or prevented
4. **Deployment Tests** - Verify the fix works in different environments
5. **Regression Tests** - Ensure no functionality is broken

Focus on testing:
- Configuration file changes
- Security settings and policies
- Access controls and permissions
- Environment-specific configurations
- Integration with security frameworks`;

      case 'secrets':
        return `Generate comprehensive manual test cases for this Secrets vulnerability that cover:
1. **Secret Removal Tests** - Verify hardcoded secrets are removed
2. **Secret Management Tests** - Verify secrets are retrieved from secure storage
3. **Access Control Tests** - Verify only authorized components can access secrets
4. **Negative Tests** - Verify the application fails gracefully without secrets
5. **Regression Tests** - Ensure functionality still works with secure secret management

Focus on testing:
- Secret retrieval from environment variables or secret managers
- Error handling when secrets are missing
- Secret rotation and updates
- Logging (ensure secrets are not logged)`;

      case 'oss':
        return `Generate comprehensive manual test cases for this OSS (Open Source Software) vulnerability that cover:
1. **Dependency Update Tests** - Verify the updated package works correctly
2. **Functionality Tests** - Verify all features using the dependency still work
3. **Security Tests** - Verify the vulnerability is fixed
4. **Compatibility Tests** - Verify compatibility with other dependencies
5. **Regression Tests** - Ensure no breaking changes

Focus on testing:
- Package version verification
- API compatibility
- Performance impact
- Integration with other components`;

      case 'iac':
        return `Generate comprehensive manual test cases for this IaC (Infrastructure as Code) vulnerability that cover:
1. **Infrastructure Deployment Tests** - Verify secure infrastructure is deployed
2. **Security Configuration Tests** - Verify security settings are applied
3. **Resource Tests** - Verify resources are created with secure defaults
4. **Compliance Tests** - Verify compliance with security policies
5. **Regression Tests** - Ensure infrastructure still functions correctly

Focus on testing:
- Infrastructure provisioning
- Security group rules
- IAM policies and permissions
- Network configurations
- Resource tagging and organization`;

      case 'containers':
        return `Generate comprehensive manual test cases for this Container vulnerability that cover:
1. **Image Security Tests** - Verify secure base images and dependencies
2. **Container Runtime Tests** - Verify secure container configurations
3. **Security Scanning Tests** - Verify vulnerabilities are fixed
4. **Deployment Tests** - Verify containers deploy and run securely
5. **Regression Tests** - Ensure container functionality is maintained

Focus on testing:
- Container image builds
- Runtime security settings
- Network policies
- Volume mounts and permissions
- Resource limits`;

      default:
        return `Generate comprehensive manual test cases that cover:
1. **Positive Test Cases** - Verify the fix works correctly
2. **Negative Test Cases** - Verify the vulnerability is fixed
3. **Edge Cases** - Test boundary conditions
4. **Security Tests** - Verify security controls are effective
5. **Regression Tests** - Ensure no functionality is broken`;
    }
  }

  /**
   * Generate prompt for AI to create flowchart and test cases
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
Create a Mermaid v10 flowchart showing the vulnerable code flow. Include actual code snippets in the nodes.
You MUST use this EXACT format with the header "**MERMAID FLOWCHART (VULNERABLE):**":
\`\`\`mermaid
graph TD
    Start([START: Execution begins]) --> A["Step 1: Entry Point<br/>Code: actual_code_here"]
    A --> B["Step 2: Processing<br/>Code: actual_code_here"]
    B --> C["⚠️ VULNERABLE CODE<br/>Lines ${remediation.startLine}-${remediation.endLine}<br/>Code: ${remediation.originalCode.split('\n')[0].trim()}..."]
    C --> D["Step 3: Result<br/>Code: actual_code_here"]
    D --> End([END: Vulnerable execution])

    style C fill:#ffcccc,stroke:#d73a4a,stroke-width:3px
    style End fill:#ffcccc,stroke:#d73a4a
\`\`\`

**MERMAID FLOWCHART (SECURE):**
Create a Mermaid v10 flowchart showing the fixed code flow. Include actual code snippets in the nodes.
You MUST use this EXACT format with the header "**MERMAID FLOWCHART (SECURE):**":
\`\`\`mermaid
graph TD
    Start([START: Execution begins]) --> A["Step 1: Entry Point<br/>Code: actual_code_here"]
    A --> B["Step 2: Processing<br/>Code: actual_code_here"]
    B --> C["✓ SECURE CODE<br/>Lines ${remediation.startLine}-${remediation.endLine}<br/>Code: ${remediation.fixedCode.split('\n')[0].trim()}..."]
    C --> D["Step 3: Result<br/>Code: actual_code_here"]
    D --> End([END: Secure execution])

    style C fill:#ccffcc,stroke:#28a745,stroke-width:3px
    style End fill:#ccffcc,stroke:#28a745
\`\`\`

CRITICAL FLOWCHART REQUIREMENTS:
1. You MUST include BOTH flowcharts (VULNERABLE and SECURE) with the EXACT headers shown above
2. Use Mermaid v10 syntax: "graph TD" for top-down flowcharts
3. Include ACTUAL CODE SNIPPETS in each node (use <br/> for line breaks in Mermaid)
4. Show the execution flow step by step with real code from the file
5. Highlight the vulnerable/fixed code section with the provided styles
6. Keep code snippets short (1-2 lines per node) but meaningful
7. Use descriptive labels for each step
8. Show the difference between vulnerable and secure flows clearly
9. DO NOT skip the flowchart sections - they are REQUIRED
10. IMPORTANT: When including code in Mermaid nodes, you MUST escape special characters:
    - Replace double quotes " with single quotes '
    - Replace backslashes \\ with /
    - Remove or escape any characters that break Mermaid syntax: [ ] { } ( ) # " \\
    - Keep code snippets simple and readable
    - Example: Instead of "query = \\"SELECT * FROM users\\"", use "query = 'SELECT * FROM users'"

**MANUAL TEST CASES:**

${this.getTestCaseGuidance(remediation.vulnerabilityType)}

Format each test case EXACTLY as follows:
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

IMPORTANT: You MUST provide at least 5-10 comprehensive test cases. Do not skip this section.`;
  }

  /**
   * Call AI API to get flowchart and test cases
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
        throw new Error('AI API not available');
      }

      logs.info(`[Report Generation] Selecting AI models...`);

      // Select AI models (using Copilot backend)
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
      });

      if (models.length === 0) {
        logs.error(`[Report Generation] No AI models available`);
        throw new Error('No AI models available');
      }

      const model = models[0];
      logs.info(`[Report Generation] Using model: ${model.name}`);

      // Create chat messages
      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ];

      // Send request to AI
      logs.info(`[Report Generation] Sending request to AI...`);
      const response = await model.sendRequest(messages, {}, token);

      // Accumulate response
      let fullResponse = '';
      for await (const chunk of response.text) {
        fullResponse += chunk;
      }

      logs.info(`[Report Generation] Received response: ${fullResponse.length} characters`);
      return fullResponse;
    } catch (error) {
      logs.error(`[Report Generation] AI API error: ${error}`);
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
   * Create bulk PDF report for multiple remediations
   */
  private async createBulkPDFReport(
    reportData: Array<{
      remediation: RemediationEntry;
      mermaidDiagrams: { vulnerable: string; secure: string };
      testCases: string;
      fullResponse: string;
    }>,
    logs: Logs
  ): Promise<void> {
    try {
      // Generate HTML content for bulk PDF
      const htmlContent = this.generateBulkHTMLReport(reportData);

      // Save as HTML file (user can print to PDF from browser)
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error('No workspace folder found');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const reportFileName = `bulk-remediation-report-${timestamp}.html`;
      const reportPath = path.join(workspaceFolder.uri.fsPath, reportFileName);

      fs.writeFileSync(reportPath, htmlContent, 'utf-8');

      logs.info(`[Bulk Report Generation] Report saved to: ${reportPath}`);

      // Open the report in browser
      const openReport = 'Open Report';
      const printToPDF = 'Print to PDF';
      const choice = await vscode.window.showInformationMessage(
        `Bulk report generated successfully! Saved to: ${reportFileName}`,
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
      logs.error(`[Bulk Report Generation] Error creating PDF: ${error}`);
      throw error;
    }
  }

  /**
   * Extract Mermaid diagrams from AI response
   */
  private extractMermaidDiagrams(response: string): { vulnerable: string; secure: string } {
    // Try multiple patterns to extract vulnerable flowchart
    let vulnerableMermaidMatch = response.match(/\*\*MERMAID FLOWCHART \(VULNERABLE\):\*\*\s*```mermaid\s*([\s\S]*?)```/i);

    if (!vulnerableMermaidMatch) {
      // Try without asterisks
      vulnerableMermaidMatch = response.match(/MERMAID FLOWCHART \(VULNERABLE\):?\s*```mermaid\s*([\s\S]*?)```/i);
    }

    if (!vulnerableMermaidMatch) {
      // Try with "Vulnerable" instead of "(VULNERABLE)"
      vulnerableMermaidMatch = response.match(/(?:MERMAID )?FLOWCHART.*VULNERABLE.*:?\s*```mermaid\s*([\s\S]*?)```/i);
    }

    if (!vulnerableMermaidMatch) {
      // Try to find any mermaid block before "SECURE" keyword
      vulnerableMermaidMatch = response.match(/```mermaid\s*([\s\S]*?)```[\s\S]*?(?:SECURE|Fixed|After)/i);
    }

    // Try multiple patterns to extract secure flowchart
    let secureMermaidMatch = response.match(/\*\*MERMAID FLOWCHART \(SECURE\):\*\*\s*```mermaid\s*([\s\S]*?)```/i);

    if (!secureMermaidMatch) {
      // Try without asterisks
      secureMermaidMatch = response.match(/MERMAID FLOWCHART \(SECURE\):?\s*```mermaid\s*([\s\S]*?)```/i);
    }

    if (!secureMermaidMatch) {
      // Try with "Secure" instead of "(SECURE)"
      secureMermaidMatch = response.match(/(?:MERMAID )?FLOWCHART.*(?:SECURE|FIXED).*:?\s*```mermaid\s*([\s\S]*?)```/i);
    }

    if (!secureMermaidMatch) {
      // Try to find second mermaid block (after vulnerable)
      const allMermaidBlocks = response.match(/```mermaid\s*([\s\S]*?)```/gi);
      if (allMermaidBlocks && allMermaidBlocks.length >= 2) {
        const match = allMermaidBlocks[1].match(/```mermaid\s*([\s\S]*?)```/i);
        if (match) {
          secureMermaidMatch = match;
        }
      }
    }

    return {
      vulnerable: vulnerableMermaidMatch ? vulnerableMermaidMatch[1].trim() : '',
      secure: secureMermaidMatch ? secureMermaidMatch[1].trim() : ''
    };
  }

  /**
   * Extract test cases from AI response
   */
  private extractTestCases(response: string): string {
    // Try multiple patterns to extract test cases
    let testCasesMatch = response.match(/\*\*MANUAL TEST CASES:\*\*\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);

    if (!testCasesMatch) {
      testCasesMatch = response.match(/MANUAL TEST CASES:?\s*([\s\S]*?)(?=\n\n[A-Z]|$)/i);
    }

    if (!testCasesMatch) {
      // Try with emoji format: 🧪 Manual Test Cases
      testCasesMatch = response.match(/🧪\s*Manual Test Cases\s*([\s\S]*?)(?=\n\n[A-Z#]|$)/i);
    }

    if (!testCasesMatch) {
      testCasesMatch = response.match(/Test Cases?:?\s*([\s\S]*?)(?=\n\n|$)/i);
    }

    if (!testCasesMatch) {
      // If no test cases section found, check if the entire response contains test cases
      if (response.includes('Test Case') || response.includes('test case')) {
        return response;
      }
      return 'No test cases generated. Please try again.';
    }

    return testCasesMatch[1].trim();
  }

  /**
   * Convert markdown test cases to properly formatted HTML
   */
  private convertTestCasesToHTML(markdown: string): string {
    if (!markdown || markdown.trim() === '' || markdown.includes('No test cases')) {
      return '<p class="no-test-cases">No test cases available. The AI may not have generated test cases in the expected format.</p>';
    }

    let html = markdown;

    // First, try to detect and convert various test case formats
    // Check for numbered test cases without "Test Case" prefix (e.g., "1. Test Name")
    if (/^\d+\.\s+[A-Z]/m.test(html) && !/Test Case \d+/i.test(html)) {
      // Convert numbered list to test case format
      html = html.replace(/^(\d+)\.\s+(.+?)$/gim, '### Test Case $1: $2');
    }

    // Check if we have any test case headers at all
    const hasTestCaseHeaders = /#{1,3}\s*Test Case/i.test(html);

    if (!hasTestCaseHeaders) {
      // Try to find test cases in a different format
      // Maybe the AI used ## instead of ###, or "Test" instead of "Test Case"
      if (/##\s*Test/i.test(html)) {
        html = html.replace(/##\s*(Test.*?)(?=\n|$)/g, '### $1');
      } else if (/\*\*Test Case \d+/i.test(html)) {
        // Convert **Test Case X:** to ### Test Case X:
        html = html.replace(/\*\*(Test Case \d+:.*?)\*\*/g, '### $1');
      } else if (/^#\s*$/m.test(html)) {
        // AI used single # as separator - convert to ###
        // Look for pattern: # \n Test Case X: Title \n -
        html = html.replace(/#\s*\n\s*(Test Case \d+:.*?)(?=\n|$)/gi, '### $1');
      } else if (/Test Case \d+:/i.test(html)) {
        // Plain text format without markdown headers
        html = html.replace(/^(Test Case \d+:.*?)$/gim, '### $1');
      } else if (/\*\*\d+\.\s+/i.test(html)) {
        // Format: **1. Test Name**
        html = html.replace(/\*\*(\d+)\.\s+(.+?)\*\*/gi, '### Test Case $1: $2');
      } else {
        // Last resort: try to parse as simple text with basic structure
        // If it contains common test case keywords, try to format it
        if (/objective|precondition|expected|steps/i.test(html)) {
          // Has test case structure but no headers - add minimal formatting
          return `<div class="test-cases-raw">
            <h3 style="color: #0066cc; margin-bottom: 15px;">Manual Test Cases</h3>
            <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 4px; line-height: 1.6;">${this.escapeHtml(markdown)}</pre>
          </div>`;
        }

        // No recognizable test case format - return raw content with basic formatting
        return `<div class="test-cases-raw">
          <p class="no-test-cases">Test cases are in an unexpected format. Displaying raw content:</p>
          <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 4px;">${this.escapeHtml(markdown)}</pre>
        </div>`;
      }
    }

    // Split into test case blocks - support ###, ##, or just plain "Test Case"
    const testCaseBlocks = html.split(/(?=#{1,3}\s*Test Case)/i);

    let formattedHTML = '';

    for (const block of testCaseBlocks) {
      if (!block.trim()) {
        continue;
      }

      let testCaseHTML = block;

      // Convert headers - support ###, ##, or #
      testCaseHTML = testCaseHTML.replace(/#{1,3}\s*(Test Case \d+:.*?)(?=\n|$)/gi, '<h3 class="test-case-title">$1</h3>');

      // Convert bold labels with proper structure - handle multiple formats
      // Format 1: - **Label:** value
      testCaseHTML = testCaseHTML.replace(/[-*]\s*\*\*(Objective|Preconditions|Expected Result|Actual Result|Status|Test Steps|Description|Setup|Teardown):\*\*\s*(.*?)(?=\n|$)/gi,
        '<div class="test-field"><strong>$1:</strong> <span>$2</span></div>');

      // Format 2: **Label:** value (without bullet)
      testCaseHTML = testCaseHTML.replace(/^\s*\*\*(Objective|Preconditions|Expected Result|Actual Result|Status|Test Steps|Description|Setup|Teardown):\*\*\s*(.*?)(?=\n|$)/gim,
        '<div class="test-field"><strong>$1:</strong> <span>$2</span></div>');

      // Format 3: Label: value (without bold or bullet) - common in simple formats
      testCaseHTML = testCaseHTML.replace(/^[-*]?\s*(Objective|Preconditions|Expected Result|Actual Result|Status|Test Steps|Description|Setup|Teardown):\s*(.+?)(?=\n|$)/gim,
        (match, label, value) => {
          // Only convert if not already converted
          if (!match.includes('<div class="test-field">')) {
            return `<div class="test-field"><strong>${label}:</strong> <span>${value}</span></div>`;
          }
          return match;
        });

      // Handle Test Steps section specially - multiple formats
      testCaseHTML = testCaseHTML.replace(/[-*]?\s*\*\*Test Steps:?\*\*\s*([\s\S]*?)(?=[-*]?\s*\*\*[A-Z]|$)/gi, (match, steps) => {
        // Extract numbered steps
        const stepMatches = steps.match(/\s*\d+\.\s+(.+?)(?=\n|$)/g);
        if (stepMatches && stepMatches.length > 0) {
          const stepsList = stepMatches.map((step: string) => {
            const stepText = step.replace(/^\s*\d+\.\s+/, '').trim();
            return `<li>${stepText}</li>`;
          }).join('');
          return `<div class="test-field"><strong>Test Steps:</strong><ol class="test-steps">${stepsList}</ol></div>`;
        }
        return match;
      });

      // Clean up empty bullets and standalone dashes
      testCaseHTML = testCaseHTML.replace(/^[-*]\s*$/gm, '');
      testCaseHTML = testCaseHTML.replace(/\n{3,}/g, '\n\n'); // Remove excessive newlines

      // Wrap in test case container if we have a title
      if (testCaseHTML.includes('test-case-title')) {
        formattedHTML += `<div class="test-case-block">${testCaseHTML}</div>`;
      } else if (testCaseHTML.trim().length > 0) {
        // Even without a title, include the content
        formattedHTML += `<div class="test-case-block">${testCaseHTML}</div>`;
      }
    }

    if (!formattedHTML) {
      // Last resort - show raw content
      return `<div class="test-cases-raw">
        <p class="no-test-cases">Test cases could not be parsed. Displaying raw content:</p>
        <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 4px;">${this.escapeHtml(markdown)}</pre>
      </div>`;
    }

    return formattedHTML;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
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

    // Convert markdown-style test cases to HTML with proper structure
    const testCasesHTML = this.convertTestCasesToHTML(testCases);

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

        .test-case-block {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }

        .test-case-title {
            color: #0066cc;
            margin: 0 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #0066cc;
        }

        .test-field {
            margin: 12px 0;
            padding: 8px 0;
        }

        .test-field strong {
            color: #495057;
            display: inline-block;
            min-width: 150px;
        }

        .test-field span {
            color: #212529;
        }

        .test-steps {
            margin: 10px 0 10px 20px;
            padding-left: 20px;
        }

        .test-steps li {
            margin: 8px 0;
            color: #212529;
            line-height: 1.6;
        }

        .no-test-cases {
            background: #fff3cd;
            border: 1px solid #ffc107;
            color: #856404;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
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

  /**
   * Generate bulk HTML report for multiple remediations
   */
  private generateBulkHTMLReport(
    reportData: Array<{
      remediation: RemediationEntry;
      mermaidDiagrams: { vulnerable: string; secure: string };
      testCases: string;
      fullResponse: string;
    }>
  ): string {
    const escapeHtml = (text: string) => {
      const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>\"'`]/g, (m) => map[m]);
    };

    // Generate sections for each remediation
    const remediationSections = reportData.map((data, index) => {
      const { remediation, mermaidDiagrams, testCases } = data;
      const testCasesHTML = this.convertTestCasesToHTML(testCases);

      return `
        <div class="remediation-section ${index > 0 ? 'page-break' : ''}">
          <div class="remediation-header">
            <h2>🔒 Vulnerability ${index + 1}: ${escapeHtml(remediation.title)}</h2>
            <div class="metadata">
              <span class="badge ${remediation.severity.toLowerCase()}">${escapeHtml(remediation.severity)}</span>
              <span><strong>Type:</strong> ${remediation.vulnerabilityType.toUpperCase()}</span>
              <span><strong>File:</strong> ${escapeHtml(remediation.filePath)}</span>
              <span><strong>Lines:</strong> ${remediation.startLine}-${remediation.endLine}</span>
            </div>
          </div>

          <div class="section">
            <h3 class="section-title">📊 Execution Flow Diagrams</h3>
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

          <div class="section">
            <h3 class="section-title">💻 Code Changes</h3>
            <h4>Vulnerable Code (Before Fix)</h4>
            <div class="code-block">
              <pre>${escapeHtml(remediation.originalCode)}</pre>
            </div>

            <h4>Fixed Code (After Fix)</h4>
            <div class="code-block">
              <pre>${escapeHtml(remediation.fixedCode)}</pre>
            </div>
          </div>

          <div class="section">
            <h3 class="section-title">🧪 Manual Test Cases</h3>
            <div class="test-cases">
              ${testCasesHTML}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Calculate summary statistics
    const totalVulnerabilities = reportData.length;
    const severityCounts = reportData.reduce((acc, { remediation }) => {
      acc[remediation.severity] = (acc[remediation.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeCounts = reportData.reduce((acc, { remediation }) => {
      acc[remediation.vulnerabilityType] = (acc[remediation.vulnerabilityType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bulk Vulnerability Remediation Report</title>
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

        .main-header {
            border-bottom: 3px solid #0066cc;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        .main-header h1 {
            color: #0066cc;
            margin: 0 0 20px 0;
        }

        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }

        .stat-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #0066cc;
        }

        .stat-card h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #666;
        }

        .stat-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #0066cc;
        }

        .remediation-section {
            margin: 40px 0;
            padding: 30px;
            background: #fafafa;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
        }

        .remediation-header {
            margin-bottom: 20px;
        }

        .remediation-header h2 {
            color: #0066cc;
            margin: 0 0 15px 0;
        }

        .metadata {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
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
            font-size: 20px;
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
            background: white;
        }

        .flowchart-title {
            font-size: 16px;
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

        .test-case-block {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }

        .test-case-title {
            color: #0066cc;
            margin: 0 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #0066cc;
        }

        .test-field {
            margin: 12px 0;
            padding: 8px 0;
        }

        .test-field strong {
            color: #495057;
            display: inline-block;
            min-width: 150px;
        }

        .test-field span {
            color: #212529;
        }

        .test-steps {
            margin: 10px 0 10px 20px;
            padding-left: 20px;
        }

        .test-steps li {
            margin: 8px 0;
            color: #212529;
            line-height: 1.6;
        }

        .no-test-cases {
            background: #fff3cd;
            border: 1px solid #ffc107;
            color: #856404;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
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
        <div class="main-header">
            <h1>🔒 Bulk Vulnerability Remediation Report</h1>
            <p><strong>Total Vulnerabilities Fixed:</strong> ${totalVulnerabilities}</p>

            <div class="summary-stats">
                <div class="stat-card">
                    <h3>By Severity</h3>
                    <div class="value">${Object.entries(severityCounts).map(([sev, count]) => `${sev}: ${count}`).join(', ')}</div>
                </div>
                <div class="stat-card">
                    <h3>By Type</h3>
                    <div class="value">${Object.entries(typeCounts).map(([type, count]) => `${type.toUpperCase()}: ${count}`).join(', ')}</div>
                </div>
                <div class="stat-card">
                    <h3>Generated</h3>
                    <div class="value">${new Date().toLocaleDateString()}</div>
                </div>
            </div>
        </div>

        <button class="print-button no-print" onclick="window.print()">🖨️ Print to PDF</button>

        ${remediationSections}

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