import * as vscode from 'vscode';
import { RemediationEntry } from './remediationFileManager';
import { Logs } from '../../models/logs';

/**
 * Service for generating and displaying flow diagrams for remediation entries
 */
export class FlowDiagramService {
  private static instance: FlowDiagramService;

  private constructor() { }

  public static getInstance(): FlowDiagramService {
    if (!FlowDiagramService.instance) {
      FlowDiagramService.instance = new FlowDiagramService();
    }
    return FlowDiagramService.instance;
  }

  /**
   * Generate and display flow diagram for a remediation
   */
  public async generateFlowDiagram(
    remediation: RemediationEntry,
    logs: Logs
  ): Promise<void> {
    try {
      logs.info(`[Flow Diagram] Generating flow diagram for: ${remediation.title}`);

      // Show progress indicator
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating Flow Diagram',
          cancellable: true,
        },
        async (progress, token) => {
          progress.report({ message: 'Analyzing code with Copilot...' });

          // Generate prompt based on vulnerability type (declare outside try block for catch scope)
          const prompt = await this.generatePrompt(remediation);

          try {
            // Try to call Copilot API
            const response = await this.callCopilotAPI(prompt, logs, token);

            if (token.isCancellationRequested) {
              return;
            }

            progress.report({ message: 'Displaying flow diagram...' });

            // Display response in webview
            await this.displayFlowDiagram(remediation, response, logs);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (errorMessage.includes('No language models available')) {
              // Fallback to opening chat manually
              logs.info('[Flow Diagram] Language Model API not available, falling back to manual chat');
              vscode.window.showInformationMessage('Opening Copilot Chat to generate flow diagram...');
              await this.openCopilotChat(prompt, logs);
            } else {
              throw error;
            }
          }
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logs.error(`[Flow Diagram] Error: ${errorMessage}`);

      // Don't show error if we already fell back to manual chat
      if (!errorMessage.includes('No language models available')) {
        vscode.window.showErrorMessage(`Failed to generate flow diagram: ${errorMessage}`);
      }
    }
  }

  /**
   * Read full file content to provide context
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
   * Generate prompt based on vulnerability type with full file context
   */
  private async generatePrompt(remediation: RemediationEntry): Promise<string> {
    // Read the full file content for better context
    const fullFileContent = await this.readFullFileContent(remediation.filePath);

    const hasFullContent = fullFileContent.length > 0;
    const fileContext = hasFullContent ? `

Full File Content (for context):
\`\`\`
${fullFileContent}
\`\`\`
` : '';

    const baseInfo = `
File: ${remediation.filePath}
Vulnerability Location: Lines ${remediation.startLine}-${remediation.endLine}
Severity: ${remediation.severity}
Title: ${remediation.title}
${fileContext}

Vulnerable Code Snippet (Lines ${remediation.startLine}-${remediation.endLine}):
\`\`\`
${remediation.originalCode}
\`\`\`

Fixed Code:
\`\`\`
${remediation.fixedCode}
\`\`\`
`;

    return `You are a security expert analyzing a code vulnerability fix. Your task is to:

1. **ANALYZE THE ENTIRE FILE**: ${hasFullContent ? 'Review the full file content provided above to understand the complete context.' : 'Analyze the code snippet provided.'}

2. **IDENTIFY ALL COMPONENTS/MODULES**: Find all functions, classes, methods, or modules in the file that are part of the execution flow leading to the vulnerability.

3. **CREATE COMPLETE EXECUTION FLOW**: Describe the step-by-step execution flow from the entry point (e.g., main function, API endpoint, event handler) all the way to the vulnerable line at lines ${remediation.startLine}-${remediation.endLine}.

4. **HIGHLIGHT VULNERABILITY LOCATION**: Clearly identify which specific component/function/line contains the vulnerability.

5. **EXPLAIN THE VULNERABILITY**: Describe what makes this code vulnerable and what attack vectors it enables.

6. **EXPLAIN THE FIX**: Describe how the fixed code prevents the vulnerability.

${baseInfo}

**IMPORTANT**:
- Trace the execution flow from the beginning of the file to the vulnerable lines ${remediation.startLine}-${remediation.endLine}
- Include ALL components/functions that are called in the execution path
- Show how data flows through each component until it reaches the vulnerable code
- Identify the exact component/function where the vulnerability exists

Please provide your analysis in the following format:

**MERMAID FLOWCHART (VULNERABLE):**
\`\`\`mermaid
graph TD
    Start([START]) --> A[EntryPoint: function_name]
    A --> B[Component1: function_name]
    B --> C[Component2: function_name]
    C --> D["VulnerableComponent: function_name
Lines ${remediation.startLine}-${remediation.endLine}
⚠️ VULNERABILITY"]
    D --> E([VULNERABLE])

    style D fill:#ffcccc,stroke:#d73a4a,stroke-width:3px
\`\`\`

**MERMAID FLOWCHART (SECURE):**
\`\`\`mermaid
graph TD
    Start([START]) --> A[EntryPoint: function_name]
    A --> B[Component1: function_name]
    B --> C[Component2: function_name]
    C --> D["FixedComponent: function_name
Lines ${remediation.startLine}-${remediation.endLine}
✓ SECURE"]
    D --> E([SECURE])

    style D fill:#ccffcc,stroke:#28a745,stroke-width:3px
\`\`\`

**COMPONENTS IDENTIFIED:**
- EntryPoint: [Name] - [Description of entry point function/method]
- Component1: [Name] - [Description]
- Component2: [Name] - [Description]
- VulnerableComponent: [Name at lines ${remediation.startLine}-${remediation.endLine}] - [Description]
- ... (list all components in execution order)

**EXECUTION FLOW:**
1. EntryPoint → [What happens at the start]
2. Component1 → [What happens next]
3. Component2 → [What happens next]
4. VulnerableComponent (Lines ${remediation.startLine}-${remediation.endLine}) → [What happens at vulnerable code]
... (complete step-by-step flow from start to vulnerable line)

**VULNERABILITY LOCATION:**
- Component: [Exact function/method name at lines ${remediation.startLine}-${remediation.endLine}]
- Line Numbers: ${remediation.startLine}-${remediation.endLine}
- Issue: [What's wrong]
- Attack Vector: [How it can be exploited]

**SECURITY FIX:**
- What Changed: [Description of changes]
- Security Control: [How it prevents the attack]
- Best Practice: [Security principle applied]

Be specific and technical. Focus on the actual code components and their interactions. Show the COMPLETE execution path from entry point to vulnerability.`;
  }

  /**
   * Call Copilot API to get flow diagram response
   */
  private async callCopilotAPI(
    prompt: string,
    logs: Logs,
    token: vscode.CancellationToken
  ): Promise<string> {
    try {
      // Check if Language Model API is available (VSCode 1.90+)
      if (!vscode.lm || typeof vscode.lm.selectChatModels !== 'function') {
        logs.info(`[Flow Diagram] Language Model API not available (requires VSCode 1.90+)`);
        throw new Error('No language models available');
      }

      logs.info(`[Flow Diagram] Selecting Copilot models...`);

      // Select Copilot models
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
      });

      logs.info(`[Flow Diagram] Found ${models.length} models`);

      if (models.length === 0) {
        logs.info(`[Flow Diagram] No Copilot models found. GitHub Copilot may not be installed or enabled.`);
        throw new Error('No language models available');
      }

      // Use first available model
      const [model] = models;
      logs.info(
        `[Flow Diagram] Using model: ${model.id}, family: ${model.family || 'unknown'}, version: ${model.version || 'unknown'
        }`
      );

      // Create chat message
      const messages = [vscode.LanguageModelChatMessage.User(prompt)];
      logs.info(`[Flow Diagram] Sending request with prompt length: ${prompt.length}`);

      // Send request
      const response = await model.sendRequest(messages, {}, token);
      logs.info(`[Flow Diagram] Request sent, streaming response...`);

      // Accumulate response
      let fullResponse = '';
      let chunkCount = 0;

      for await (const part of response.text) {
        if (token.isCancellationRequested) {
          logs.info(`[Flow Diagram] Request cancelled by user`);
          throw new Error('Cancelled');
        }
        fullResponse += part;
        chunkCount++;

        // Log progress every 10 chunks
        if (chunkCount % 10 === 0) {
          logs.info(
            `[Flow Diagram] Received ${chunkCount} chunks, ${fullResponse.length} characters so far...`
          );
        }
      }

      logs.info(
        `[Flow Diagram] Received complete response: ${chunkCount} chunks, ${fullResponse.length} characters`
      );

      if (fullResponse.length === 0) {
        logs.warn(`[Flow Diagram] Received empty response from Copilot`);
        throw new Error('Received empty response from Copilot');
      }

      return fullResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';

      logs.error(`[Flow Diagram] API Error: ${errorMessage}`);
      logs.error(`[Flow Diagram] Error stack: ${errorStack}`);

      // Provide more helpful error messages
      if (errorMessage.includes('No language models available')) {
        logs.info(`[Flow Diagram] Falling back to manual Copilot chat`);
        throw new Error('No language models available');
      } else if (errorMessage.includes('Cancelled')) {
        throw error;
      } else if (errorMessage.includes('consent')) {
        throw new Error('Copilot access requires user consent. Please try again and accept the consent dialog.');
      } else {
        throw new Error(`Failed to call Copilot API: ${errorMessage}`);
      }
    }
  }

  /**
   * Open Copilot chat with the prompt (fallback)
   */
  private async openCopilotChat(prompt: string, logs: Logs): Promise<void> {
    try {
      logs.info('[Flow Diagram] Opening Copilot chat with prompt');
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query: prompt,
      });
    } catch (error) {
      logs.error(`[Flow Diagram] Failed to open Copilot chat: ${error}`);
      vscode.window.showErrorMessage('Failed to open Copilot chat. Please ensure GitHub Copilot is installed.');
    }
  }

  /**
   * Display flow diagram in webview (simple HTML/CSS, no Mermaid)
   */
  private async displayFlowDiagram(
    remediation: RemediationEntry,
    response: string,
    logs: Logs
  ): Promise<void> {
    try {
      logs.info('[Flow Diagram] Creating webview panel');

      const panel = vscode.window.createWebviewPanel(
        'flowDiagram',
        `Flow Diagram: ${remediation.title}`,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      panel.webview.html = this.getWebviewContent(remediation, response);

      logs.info('[Flow Diagram] Webview panel created successfully');
    } catch (error) {
      logs.error(`[Flow Diagram] Failed to create webview: ${error}`);
      throw error;
    }
  }

  /**
   * Extract Mermaid diagrams from AI response
   */
  private extractMermaidDiagrams(response: string, remediation: RemediationEntry): { vulnerable: string; secure: string } {
    // Try to extract Mermaid diagrams from AI response
    const vulnerableMermaidMatch = response.match(/\*\*MERMAID FLOWCHART \(VULNERABLE\):\*\*\s*```mermaid\s*([\s\S]*?)```/i);
    const secureMermaidMatch = response.match(/\*\*MERMAID FLOWCHART \(SECURE\):\*\*\s*```mermaid\s*([\s\S]*?)```/i);

    let vulnerable = vulnerableMermaidMatch ? vulnerableMermaidMatch[1].trim() : '';
    let secure = secureMermaidMatch ? secureMermaidMatch[1].trim() : '';

    // If AI didn't provide Mermaid diagrams, generate them from the parsed components
    if (!vulnerable || !secure) {
      const flowData = this.parseAIResponseForComponents(response, remediation);
      const mermaidDiagrams = this.generateMermaidFromComponents(flowData, remediation);
      vulnerable = vulnerable || mermaidDiagrams.vulnerable;
      secure = secure || mermaidDiagrams.secure;
    }

    return { vulnerable, secure };
  }

  /**
   * Generate Mermaid diagrams from parsed components (fallback)
   */
  private generateMermaidFromComponents(
    flowData: {
      vulnerableNodes: Array<{ type: string; title: string; description?: string; isVulnerable?: boolean }>;
      secureNodes: Array<{ type: string; title: string; description?: string }>;
    },
    remediation: RemediationEntry
  ): { vulnerable: string; secure: string } {
    // Generate vulnerable flow
    let vulnerableMermaid = 'graph TD\n';
    flowData.vulnerableNodes.forEach((node, index) => {
      const nodeId = String.fromCharCode(65 + index); // A, B, C, D...
      const prevNodeId = index > 0 ? String.fromCharCode(65 + index - 1) : '';

      let nodeLabel = node.title;
      if (node.description) {
        nodeLabel += `\\n${node.description}`;
      }

      // Determine node shape
      let nodeDefinition = '';
      if (node.type === 'terminator') {
        nodeDefinition = `${nodeId}([${nodeLabel}])`;
      } else if (node.type === 'decision') {
        nodeDefinition = `${nodeId}{${nodeLabel}}`;
      } else if (node.type === 'data') {
        nodeDefinition = `${nodeId}[/${nodeLabel}/]`;
      } else if (node.isVulnerable) {
        nodeDefinition = `${nodeId}["${nodeLabel}\\nLines ${remediation.startLine}-${remediation.endLine}\\n⚠️ VULNERABILITY"]`;
      } else {
        nodeDefinition = `${nodeId}[${nodeLabel}]`;
      }

      vulnerableMermaid += `    ${nodeDefinition}\n`;

      if (prevNodeId) {
        vulnerableMermaid += `    ${prevNodeId} --> ${nodeId}\n`;
      }

      // Add styling for vulnerable node
      if (node.isVulnerable) {
        vulnerableMermaid += `    style ${nodeId} fill:#ffcccc,stroke:#d73a4a,stroke-width:3px\n`;
      }
    });

    // Generate secure flow
    let secureMermaid = 'graph TD\n';
    flowData.secureNodes.forEach((node, index) => {
      const nodeId = String.fromCharCode(65 + index); // A, B, C, D...
      const prevNodeId = index > 0 ? String.fromCharCode(65 + index - 1) : '';

      let nodeLabel = node.title;
      if (node.description) {
        nodeLabel += `\\n${node.description}`;
      }

      // Check if this was the vulnerable node (same position)
      const wasVulnerable = flowData.vulnerableNodes[index]?.isVulnerable;

      // Determine node shape
      let nodeDefinition = '';
      if (node.type === 'terminator') {
        nodeDefinition = `${nodeId}([${nodeLabel}])`;
      } else if (node.type === 'decision') {
        nodeDefinition = `${nodeId}{${nodeLabel}}`;
      } else if (node.type === 'data') {
        nodeDefinition = `${nodeId}[/${nodeLabel}/]`;
      } else if (wasVulnerable) {
        nodeDefinition = `${nodeId}["${nodeLabel}\\nLines ${remediation.startLine}-${remediation.endLine}\\n✓ SECURE"]`;
      } else {
        nodeDefinition = `${nodeId}[${nodeLabel}]`;
      }

      secureMermaid += `    ${nodeDefinition}\n`;

      if (prevNodeId) {
        secureMermaid += `    ${prevNodeId} --> ${nodeId}\n`;
      }

      // Add styling for fixed node
      if (wasVulnerable) {
        secureMermaid += `    style ${nodeId} fill:#ccffcc,stroke:#28a745,stroke-width:3px\n`;
      }
    });

    return {
      vulnerable: vulnerableMermaid,
      secure: secureMermaid
    };
  }

  /**
   * Generate webview HTML content with Mermaid flowchart diagram
   */
  private getWebviewContent(remediation: RemediationEntry, response: string): string {
    // Extract Mermaid diagrams from AI response (with fallback generation)
    const mermaidDiagrams = this.extractMermaidDiagrams(response, remediation);
    const escapedResponse = this.escapeHtml(response);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.jsdelivr.net;">
    <title>Flowchart Diagram</title>
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
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }
        .title {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .metadata {
            display: flex;
            gap: 20px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            flex-wrap: wrap;
        }
        .badge {
            padding: 2px 8px;
            border-radius: 3px;
            font-weight: bold;
        }
        .badge.critical { background-color: #d73a4a; color: white; }
        .badge.high { background-color: #d73a4a; color: white; }
        .badge.medium { background-color: #fb8c00; color: white; }
        .badge.low { background-color: #ffd33d; color: black; }
        .badge.info { background-color: #0366d6; color: white; }

        /* Flowchart Styles */
        .flowchart-container {
            display: flex;
            gap: 30px;
            margin: 30px 0;
            flex-wrap: wrap;
            justify-content: center;
        }
        .flowchart-column {
            flex: 1;
            min-width: 350px;
            max-width: 500px;
        }
        .flowchart-title {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 30px;
        }
        .flowchart-title.vulnerable {
            background-color: rgba(220, 53, 69, 0.15);
            color: #d73a4a;
            border: 2px solid #d73a4a;
        }
        .flowchart-title.secure {
            background-color: rgba(40, 167, 69, 0.15);
            color: #28a745;
            border: 2px solid #28a745;
        }

        /* Flowchart Nodes */
        .flowchart-node {
            margin: 0 auto 30px;
            max-width: 400px;
        }

        /* Start/End (Rounded Rectangle) */
        .node-terminator {
            background-color: var(--vscode-editor-background);
            border: 2px solid var(--vscode-button-background);
            border-radius: 25px;
            padding: 12px 20px;
            text-align: center;
            font-weight: bold;
            font-size: 13px;
        }

        /* Process (Rectangle) */
        .node-process {
            background-color: var(--vscode-editor-background);
            border: 2px solid var(--vscode-button-background);
            border-radius: 4px;
            padding: 15px;
        }

        /* Decision (Diamond) */
        .node-decision {
            background-color: var(--vscode-editor-background);
            border: 2px solid var(--vscode-button-background);
            padding: 15px;
            position: relative;
            margin: 20px auto;
            width: 200px;
            height: 100px;
            transform: rotate(45deg);
        }
        .node-decision-content {
            transform: rotate(-45deg);
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            width: 140px;
            text-align: center;
            font-size: 11px;
        }

        /* Data/Input (Parallelogram) */
        .node-data {
            background-color: var(--vscode-editor-background);
            border: 2px solid var(--vscode-button-background);
            padding: 12px 20px;
            position: relative;
            margin: 0 20px;
            transform: skewX(-20deg);
        }
        .node-data-content {
            transform: skewX(20deg);
        }

        /* Node Content */
        .node-title {
            font-weight: bold;
            font-size: 13px;
            margin-bottom: 6px;
        }
        .node-desc {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        .node-code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 8px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 10px;
            margin-top: 8px;
            overflow-x: auto;
            white-space: pre;
        }

        /* Vulnerable Flow Specific */
        .vulnerable .node-terminator,
        .vulnerable .node-process,
        .vulnerable .node-decision,
        .vulnerable .node-data {
            border-color: #d73a4a;
        }
        .attack-box {
            background-color: rgba(220, 53, 69, 0.15);
            border-left: 3px solid #d73a4a;
            padding: 8px;
            margin-top: 8px;
            border-radius: 3px;
            font-size: 10px;
        }

        /* Secure Flow Specific */
        .secure .node-terminator,
        .secure .node-process,
        .secure .node-decision,
        .secure .node-data {
            border-color: #28a745;
        }
        .security-box {
            background-color: rgba(40, 167, 69, 0.15);
            border-left: 3px solid #28a745;
            padding: 8px;
            margin-top: 8px;
            border-radius: 3px;
            font-size: 10px;
        }

        /* Connector Arrow */
        .connector {
            text-align: center;
            font-size: 24px;
            margin: -10px 0;
            color: var(--vscode-descriptionForeground);
        }

        /* Vulnerable Component Highlighting */
        .vulnerable-component {
            position: relative;
        }
        .vulnerable-component .node-terminator,
        .vulnerable-component .node-process,
        .vulnerable-component .node-decision,
        .vulnerable-component .node-data {
            border-color: #d73a4a !important;
            border-width: 3px !important;
            box-shadow: 0 0 10px rgba(220, 53, 69, 0.5);
            background-color: rgba(220, 53, 69, 0.1);
        }
        .vulnerable-badge {
            position: absolute;
            top: -10px;
            right: -10px;
            background-color: #d73a4a;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
            z-index: 10;
        }

        .details-section {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 20px;
            margin-top: 30px;
        }
        .details-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .analysis {
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            line-height: 1.6;
        }
        .actions {
            margin-top: 15px;
            display: flex;
            gap: 10px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 12px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${this.escapeHtml(remediation.title)}</div>
        <div class="metadata">
            <span class="badge ${remediation.severity.toLowerCase()}">${this.escapeHtml(remediation.severity)}</span>
            <span>${remediation.vulnerabilityType.toUpperCase()}</span>
            <span>${this.escapeHtml(remediation.filePath)}:${remediation.startLine}-${remediation.endLine}</span>
        </div>
    </div>

    <div class="flowchart-container">
        <!-- Vulnerable Flowchart -->
        <div class="flowchart-column vulnerable">
            <div class="flowchart-title vulnerable">🔴 Vulnerable Execution Flow</div>
            ${mermaidDiagrams.vulnerable ? `
                <div class="mermaid">
                    ${mermaidDiagrams.vulnerable}
                </div>
            ` : '<p style="text-align: center; color: var(--vscode-descriptionForeground);">No Mermaid diagram available. See detailed analysis below.</p>'}
        </div>

        <!-- Secure Flowchart -->
        <div class="flowchart-column secure">
            <div class="flowchart-title secure">🟢 Secure Execution Flow</div>
            ${mermaidDiagrams.secure ? `
                <div class="mermaid">
                    ${mermaidDiagrams.secure}
                </div>
            ` : '<p style="text-align: center; color: var(--vscode-descriptionForeground);">No Mermaid diagram available. See detailed analysis below.</p>'}
        </div>
    </div>

    <div class="details-section">
        <div class="details-title">📋 Detailed Analysis from Copilot</div>
        <div class="analysis">${escapedResponse}</div>
        <div class="actions">
            <button onclick="copyToClipboard()">📋 Copy Full Analysis</button>
        </div>
    </div>

    <script>
        function copyToClipboard() {
            const content = \`${escapedResponse}\`;
            navigator.clipboard.writeText(content).then(() => {
                const btn = event.target;
                const orig = btn.textContent;
                btn.textContent = '✓ Copied!';
                setTimeout(() => btn.textContent = orig, 2000);
            });
        }
    </script>
</body>
</html>`;
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
      "'": '&#039;',
      '`': '&#96;',
    };
    return text.replace(/[&<>"'`]/g, (m) => map[m]);
  }

  /**
   * Parse AI response to extract components and create flowchart
   */
  private parseAIResponseForComponents(aiResponse: string, remediation: RemediationEntry): {
    vulnerableNodes: Array<{ type: string; title: string; description?: string; code?: string; attack?: string; isVulnerable?: boolean }>;
    secureNodes: Array<{ type: string; title: string; description?: string; code?: string; security?: string }>;
  } {
    const vulnerableNodes = [];
    const secureNodes = [];

    try {
      // Extract sections from AI response
      const flowMatch = aiResponse.match(/\*\*EXECUTION FLOW:\*\*\s*([\s\S]*?)(?=\*\*VULNERABILITY LOCATION:|$)/i);
      const vulnLocationMatch = aiResponse.match(/\*\*VULNERABILITY LOCATION:\*\*\s*([\s\S]*?)(?=\*\*SECURITY FIX:|$)/i);

      let vulnerableComponent = '';
      if (vulnLocationMatch) {
        const compMatch = vulnLocationMatch[1].match(/[-*]\s*Component:\s*([^\n]+)/i);
        if (compMatch) {
          vulnerableComponent = compMatch[1].trim();
        }
      }

      // Parse execution flow steps
      if (flowMatch && flowMatch[1]) {
        const flowSteps = flowMatch[1].trim().split('\n').filter(line => line.trim().match(/^\d+\./));

        if (flowSteps.length > 0) {
          vulnerableNodes.push({ type: 'terminator', title: 'START' });
          secureNodes.push({ type: 'terminator', title: 'START' });

          flowSteps.forEach((step) => {
            // More flexible regex - matches various formats:
            // "1. ComponentName → Description"
            // "1. [ComponentName] → Description"
            // "1. ComponentName - Description"
            const stepMatch = step.match(/^\d+\.\s*(?:\[([^\]]+)\]|([^→\-:]+?))\s*[→\-:]\s*(.+)/);
            if (stepMatch) {
              const componentName = (stepMatch[1] || stepMatch[2] || '').trim();
              const description = stepMatch[3].trim();

              if (componentName) {
                // Determine if this component is vulnerable
                const isVulnerable = vulnerableComponent &&
                  (componentName.toLowerCase().includes(vulnerableComponent.toLowerCase()) ||
                    vulnerableComponent.toLowerCase().includes(componentName.toLowerCase()));

                // Determine node type based on content
                let nodeType = 'process';
                if (description.toLowerCase().includes('input') || description.toLowerCase().includes('data') || description.toLowerCase().includes('config')) {
                  nodeType = 'data';
                } else if (description.includes('?') || description.toLowerCase().includes('check') || description.toLowerCase().includes('validate')) {
                  nodeType = 'decision';
                }

                // Add vulnerable node
                vulnerableNodes.push({
                  type: nodeType,
                  title: componentName,
                  description: description,
                  isVulnerable: isVulnerable,
                  attack: isVulnerable ? 'Vulnerability detected here' : undefined
                });

                // Add secure node
                secureNodes.push({
                  type: nodeType,
                  title: componentName,
                  description: description,
                  security: isVulnerable ? 'Fixed in secure version' : undefined
                });
              }
            }
          });

          vulnerableNodes.push({ type: 'terminator', title: 'VULNERABLE' });
          secureNodes.push({ type: 'terminator', title: 'SECURE' });

          return { vulnerableNodes, secureNodes };
        }
      }
    } catch (error) {
      // Fall through to fallback
    }

    // Fallback: Use the hardcoded flowchart
    return this.parseResponseForFlowchart(remediation);
  }

  /**
   * Parse remediation data to create flowchart nodes (fallback method)
   */
  private parseResponseForFlowchart(remediation: RemediationEntry): {
    vulnerableNodes: Array<{ type: string; title: string; description?: string; code?: string; attack?: string }>;
    secureNodes: Array<{ type: string; title: string; description?: string; code?: string; security?: string }>;
  } {
    const vulnerableNodes = [];
    const secureNodes = [];

    const originalCode = remediation.originalCode.trim();
    const fixedCode = remediation.fixedCode.trim();

    switch (remediation.vulnerabilityType) {
      case 'secrets':
        vulnerableNodes.push(
          { type: 'terminator', title: 'START' },
          {
            type: 'data',
            title: 'Source Code',
            description: 'Secret hardcoded in file',
            code: originalCode.split('\n').slice(0, 3).join('\n'),
            attack: 'Exposed in repository'
          },
          {
            type: 'process',
            title: 'Commit to Git',
            description: 'Secret stored in version control',
            attack: 'Persists in VCS history forever'
          },
          {
            type: 'decision',
            title: 'Access Control?'
          },
          {
            type: 'process',
            title: 'Unauthorized Access',
            description: 'Attackers can use the secret',
            attack: 'API abuse, data breach, privilege escalation'
          },
          { type: 'terminator', title: 'SECURITY BREACH' }
        );

        secureNodes.push(
          { type: 'terminator', title: 'START' },
          {
            type: 'data',
            title: 'Source Code',
            description: 'Secret loaded from environment',
            code: fixedCode.split('\n').slice(0, 3).join('\n'),
            security: 'No hardcoded secrets'
          },
          {
            type: 'process',
            title: 'Runtime Configuration',
            description: 'Secret fetched from secure storage',
            security: 'Environment variables or vault'
          },
          {
            type: 'decision',
            title: 'Access Control?'
          },
          {
            type: 'process',
            title: 'Controlled Access',
            description: 'Secret is protected and rotatable',
            security: 'Least privilege, rotation, audit logging'
          },
          { type: 'terminator', title: 'SECURE' }
        );
        break;

      case 'oss':
        vulnerableNodes.push(
          { type: 'terminator', title: 'START' },
          {
            type: 'data',
            title: 'Dependency Declaration',
            description: 'Package with known CVE',
            code: originalCode.split('\n')[0],
            attack: 'Vulnerable dependency included'
          },
          {
            type: 'process',
            title: 'Application Build',
            description: 'Vulnerable package bundled',
            attack: 'CVE present in production'
          },
          {
            type: 'decision',
            title: 'Exploit Available?'
          },
          {
            type: 'process',
            title: 'Security Breach',
            description: 'Vulnerability exploited',
            attack: 'RCE, XSS, SQL injection, or data breach'
          },
          { type: 'terminator', title: 'COMPROMISED' }
        );

        secureNodes.push(
          { type: 'terminator', title: 'START' },
          {
            type: 'data',
            title: 'Dependency Declaration',
            description: 'Updated to patched version',
            code: fixedCode.split('\n')[0],
            security: 'CVE patched'
          },
          {
            type: 'process',
            title: 'Application Build',
            description: 'Secure package bundled',
            security: 'No known vulnerabilities'
          },
          {
            type: 'decision',
            title: 'Exploit Available?'
          },
          {
            type: 'process',
            title: 'Protected',
            description: 'Vulnerability eliminated',
            security: 'Security patch applied'
          },
          { type: 'terminator', title: 'SECURE' }
        );
        break;

      case 'asca':
        vulnerableNodes.push(
          { type: 'terminator', title: 'START' },
          {
            type: 'data',
            title: 'User Input',
            description: 'Untrusted data received'
          },
          {
            type: 'process',
            title: 'Insecure Processing',
            description: 'No validation or sanitization',
            code: originalCode.split('\n').slice(0, 5).join('\n'),
            attack: 'SQL injection, XSS, or path traversal'
          },
          {
            type: 'decision',
            title: 'Malicious Input?'
          },
          {
            type: 'process',
            title: 'Exploitation',
            description: 'Attack executed',
            attack: 'Data breach, unauthorized access, code execution'
          },
          { type: 'terminator', title: 'COMPROMISED' }
        );

        secureNodes.push(
          { type: 'terminator', title: 'START' },
          {
            type: 'data',
            title: 'User Input',
            description: 'Untrusted data received'
          },
          {
            type: 'process',
            title: 'Secure Processing',
            description: 'Validation and sanitization applied',
            code: fixedCode.split('\n').slice(0, 5).join('\n'),
            security: 'Input validation, parameterization, encoding'
          },
          {
            type: 'decision',
            title: 'Malicious Input?'
          },
          {
            type: 'process',
            title: 'Attack Blocked',
            description: 'Malicious input rejected or neutralized',
            security: 'Secure coding practices prevent exploitation'
          },
          { type: 'terminator', title: 'SECURE' }
        );
        break;

      case 'iac':
        vulnerableNodes.push(
          { type: 'terminator', title: 'START' },
          {
            type: 'data',
            title: 'Infrastructure Config',
            description: 'IaC template with misconfigurations',
            code: originalCode.split('\n').slice(0, 5).join('\n'),
            attack: 'Open ports, weak encryption, public access'
          },
          {
            type: 'process',
            title: 'Deploy to Cloud',
            description: 'Insecure infrastructure provisioned',
            attack: 'Attack surface exposed'
          },
          {
            type: 'decision',
            title: 'Publicly Accessible?'
          },
          {
            type: 'process',
            title: 'Security Incident',
            description: 'Infrastructure compromised',
            attack: 'Data exposure, unauthorized access, compliance violation'
          },
          { type: 'terminator', title: 'BREACH' }
        );

        secureNodes.push(
          { type: 'terminator', title: 'START' },
          {
            type: 'data',
            title: 'Infrastructure Config',
            description: 'IaC template with security best practices',
            code: fixedCode.split('\n').slice(0, 5).join('\n'),
            security: 'Encryption, access controls, least privilege'
          },
          {
            type: 'process',
            title: 'Deploy to Cloud',
            description: 'Secure infrastructure provisioned',
            security: 'Security controls enforced'
          },
          {
            type: 'decision',
            title: 'Publicly Accessible?'
          },
          {
            type: 'process',
            title: 'Protected',
            description: 'Infrastructure hardened',
            security: 'Minimal attack surface, compliance met'
          },
          { type: 'terminator', title: 'SECURE' }
        );
        break;

      case 'containers':
        vulnerableNodes.push(
          { type: 'terminator', title: 'START' },
          {
            type: 'data',
            title: 'Container Image',
            description: 'Base image with CVEs',
            code: originalCode.split('\n').slice(0, 3).join('\n'),
            attack: 'Vulnerable packages in image'
          },
          {
            type: 'process',
            title: 'Container Runtime',
            description: 'Vulnerable container deployed',
            attack: 'Exploitable at runtime'
          },
          {
            type: 'decision',
            title: 'Exploit Available?'
          },
          {
            type: 'process',
            title: 'Container Compromise',
            description: 'Attacker gains access',
            attack: 'Container escape, privilege escalation'
          },
          { type: 'terminator', title: 'COMPROMISED' }
        );

        secureNodes.push(
          { type: 'terminator', title: 'START' },
          {
            type: 'data',
            title: 'Container Image',
            description: 'Patched base image',
            code: fixedCode.split('\n').slice(0, 3).join('\n'),
            security: 'Vulnerabilities patched'
          },
          {
            type: 'process',
            title: 'Container Runtime',
            description: 'Secure container deployed',
            security: 'Security policies enforced'
          },
          {
            type: 'decision',
            title: 'Exploit Available?'
          },
          {
            type: 'process',
            title: 'Protected',
            description: 'Container hardened',
            security: 'Minimal attack surface, no known CVEs'
          },
          { type: 'terminator', title: 'SECURE' }
        );
        break;

      default:
        vulnerableNodes.push(
          { type: 'terminator', title: 'START' },
          {
            type: 'process',
            title: 'Vulnerability Present',
            description: 'Code contains security issue',
            code: originalCode.split('\n').slice(0, 5).join('\n')
          },
          { type: 'terminator', title: 'VULNERABLE' }
        );

        secureNodes.push(
          { type: 'terminator', title: 'START' },
          {
            type: 'process',
            title: 'Vulnerability Fixed',
            description: 'Code has been remediated',
            code: fixedCode.split('\n').slice(0, 5).join('\n')
          },
          { type: 'terminator', title: 'SECURE' }
        );
    }

    return { vulnerableNodes, secureNodes };
  }
}
