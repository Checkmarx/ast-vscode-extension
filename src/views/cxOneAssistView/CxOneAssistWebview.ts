import * as vscode from "vscode";
import * as path from "path";
import { CxOneAssistWebviewState } from "./CxOneAssistTypes";
import { CxOneAssistUtils } from "./CxOneAssistUtils";

export class CxOneAssistWebview {
	/**
	 * Generates the HTML content for the CxOne Assist webview
	 */
	public static generateHtml(
		context: vscode.ExtensionContext,
		webview: vscode.Webview,
		state: CxOneAssistWebviewState
	): string {
		const cubeImageUri = webview.asWebviewUri(
			vscode.Uri.file(path.join(context.extensionPath, "media", "icons", "cxone-assist-cube.svg"))
		);

		const showIgnoredButton = CxOneAssistUtils.shouldShowIgnoredButton(state);
		const ignoredText = CxOneAssistUtils.formatIgnoredText(state.ignoredCount);
		const ignoredTooltip = CxOneAssistUtils.getIgnoredTooltip(state.ignoredCount);

		return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CxOne Assist</title>
        <style>
          ${this.getStyles()}
        </style>
    </head>
    <body>
        <div class="assist-container">
            <div class="cube-container">
                <div class="particles" id="particles"></div>
                <img src="${cubeImageUri}" alt="CxOne Assist 3D Cube" class="cube-image" />
            </div>
            
            <div class="description">
                CxOne Assist provides real-time threat detection and helps you avoid vulnerabilities before they happen.
            </div>
            
            ${showIgnoredButton ? `
            <div id="view-ignored-vuln-btn"><button class="action-link" id="ignored-vuln-button" onclick="viewIgnored()" title="${ignoredTooltip}">
                ${ignoredText}
            </button></div>
            ` : ''}
        </div>
        
        <script>
          ${this.getScript()}
        </script>
    </body>
    </html>`;
	}

	/**
	 * Returns the CSS styles for the webview
	 */
	private static getStyles(): string {
		return `
      body {
        margin: 0;
        padding: 16px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-sideBar-background);
        color: var(--vscode-sideBar-foreground);
        overflow-x: hidden;
      }
      
      .assist-container {
        text-align: center;
        position: relative;
      }
      
      .cube-container {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        perspective: 1000px;
      }
      
      .cube-image {
        width: 100%;
        height: 100%;
      }
      
      .description {
        font-size: 13px;
        line-height: 1.4;
        color: var(--vscode-descriptionForeground);
        margin: 5px 0;
        text-align: left;
      }
	
	  #view-ignored-vuln-btn {
	  	text-align: left;
	  }
      
      .action-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--vscode-textLink-foreground);
        text-decoration: none;
        font-size: 13px;
        padding: 0px;
        cursor: pointer;
        border: none;
        background: none;
        border-radius: 4px;
        transition: all 0.2s ease;
      }
      
      .action-link:hover {
        color: var(--vscode-textLink-activeForeground);
        background: var(--vscode-list-hoverBackground);
      }
      
      .action-icon {
        font-size: 14px;
      }
      
      .particles {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
      }
      
      .particle {
        position: absolute;
        width: 2px;
        height: 2px;
        background: var(--vscode-textLink-foreground);
        border-radius: 50%;
        opacity: 0.6;
        animation: particleFloat 8s infinite linear;
      }
      
      @keyframes float {
        0%, 100% { 
          transform: translateY(0px) rotateY(0deg); 
        }
        50% { 
          transform: translateY(-10px) rotateY(180deg); 
        }
      }
      
      @keyframes particleFloat {
        from {
          transform: translateY(200px) translateX(0px);
          opacity: 0;
        }
        10% {
          opacity: 0.6;
        }
        90% {
          opacity: 0.6;
        }
        to {
          transform: translateY(-20px) translateX(20px);
          opacity: 0;
        }
      }
      
      /* Hide button when not visible */
      .hidden {
        display: none !important;
      }
    `;
	}

	/**
	 * Returns the JavaScript for the webview
	 */
	private static getScript(): string {
		return `
      // VS Code API
      const vscode = acquireVsCodeApi();
      
      // Create floating particles
      function createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        
        for (let i = 0; i < 8; i++) {
          setTimeout(() => {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 3 + 's';
            particle.style.animationDuration = (Math.random() * 4 + 6) + 's';
            container.appendChild(particle);
            
            setTimeout(() => {
              if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
              }
            }, 10000);
          }, i * 500);
        }
      }
      
      function viewIgnored() {
        vscode.postMessage({ 
          command: 'viewIgnoredVulnerabilities' 
        });
      }
      
      // Initialize
      createParticles();
      setInterval(createParticles, 8000);
      
      // Listen for updates from the extension
      window.addEventListener('message', event => {
        const message = event.data;
        if (message.command === 'updateState') {
          updateUI(message.state);
        }
      });
      
      function updateUI(state) {
        const button = document.getElementById('ignored-vuln-button');
        if (!button) return;
        
        const shouldShow = state.hasIgnoreFile && state.ignoredCount > 0;
        
        if (shouldShow) {
          button.style.display = 'inline-flex';
          button.textContent = state.ignoredCount === 0 
            ? 'No ignored vulnerabilities'
            : \`View ignored vulnerabilities (\${state.ignoredCount})\`;
          button.title = state.ignoredCount === 0
            ? 'No ignored vulnerabilities found'
            : \`Click to view \${state.ignoredCount} ignored vulnerabilities\`;
        } else {
          button.style.display = 'none';
        }
      }
    `;
	}
}