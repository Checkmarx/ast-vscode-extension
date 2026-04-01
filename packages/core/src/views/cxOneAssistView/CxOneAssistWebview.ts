import * as vscode from "vscode";
import { CxOneAssistWebviewState } from "./CxOneAssistTypes";
import { CxOneAssistUtils } from "./CxOneAssistUtils";
import { MediaPathResolver } from "../../utils/mediaPathResolver";
import { getMessages } from "../../config/extensionMessages";

export class CxOneAssistWebview {
  public static generateHtml(
    context: vscode.ExtensionContext,
    webview: vscode.Webview,
    state: CxOneAssistWebviewState
  ): string {
    const cubeImageUri = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("icons", "cxone-assist-cube.svg"))
    );

    const showIgnoredButton = CxOneAssistUtils.shouldShowIgnoredButton(state);
    const ignoredText = CxOneAssistUtils.formatIgnoredText(state.ignoredCount);
    const ignoredTooltip = CxOneAssistUtils.getIgnoredTooltip(state.ignoredCount);

    const messages = getMessages();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${messages.productName}</title>
        <style>
          ${this.getStyles()}
        </style>
    </head>
    <body>
        <div class="assist-container">
            <div class="cube-container">
                <div class="particles" id="particles"></div>
                <img src="${cubeImageUri}" alt="${messages.productName} 3D Cube" class="cube-image" />
            </div>

            <div class="description">
                ${messages.assistViewDescription}
            </div>
            
            ${showIgnoredButton ? `
            <div id="view-ignored-vuln-btn"><button class="action-link" id="ignored-vuln-button" onclick="openIgnoredView()" title="${ignoredTooltip}">
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
        width: 100%;
        height: 100%;
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
      
      .hidden {
        display: none !important;
      }
    `;
  }

  private static getScript(): string {
    return `
      const vscode = acquireVsCodeApi();
      
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
      
      function openIgnoredView() {
        vscode.postMessage({ 
          command: 'openIgnoredView' 
        });
      }

      createParticles();
      setInterval(createParticles, 8000);
      
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

  public static renderDisabledStandaloneHtml(
    context: vscode.ExtensionContext,
    webview: vscode.Webview
  ): string {
    const cubeImageUri = webview.asWebviewUri(
      vscode.Uri.file(MediaPathResolver.getMediaFilePath("icons", "cxone-assist-cube.svg"))
    );

    // Get extension-specific messages
    const messages = getMessages();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${messages.productName}</title>
        <style>
          ${this.getUnauthenticatedStyles()}
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="cube-container">
                <div class="particles" id="particles"></div>
                <img src="${cubeImageUri}" alt="${messages.productName} 3D Cube" class="cube-image" />
            </div>

            <div class="login-title">Catch Vulnerabilities as You Code</div>

            <div class="login-description">
                Go beyond scanning. Our AI feature spots risks instantly and guides you with smart fixes, without leaving VS Code.
            </div>

            <div class="login-button">
                Contact your admin for more information
            </div>
        </div>
        
        <script>
          ${this.getUnauthenticatedScript()}
        </script>
    </body>
    </html>`;
  }

  private static getUnauthenticatedStyles(): string {
    return `
      body {
        margin: 0;
        padding: 16px;
        font-family: var(--vscode-font-family);
        background: var(--vscode-sideBar-background);
        color: var(--vscode-sideBar-foreground);
        overflow-x: hidden;
      }
      
      .login-container {
        text-align: center;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 200px;
      }
      
      .cube-container {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
      }
      
      .cube-image {
        width: 100%;
        height: 100%;
      }
      
      .login-title {
        font-size: 16px;
        font-weight: bold;
        color: var(--vscode-descriptionForeground);
        text-align: center;
      }

      .login-description {
        font-size: 13px;
        line-height: 1.4;
        color: var(--vscode-descriptionForeground);
        margin: 10px 0 10px 0;
        text-align: center;
      }
      
      .login-button {
        color: var(--vscode-descriptionForeground);
        border-radius: 4px;
        font-size: 13px;
        font-family: var(--vscode-font-family);
        transition: all 0.2s ease;
        outline: none;
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
    `;
  }

  private static getUnauthenticatedScript(): string {
    return `
      // VS Code API
      const vscode = acquireVsCodeApi();
      
      // Create floating particles
      function createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        
        for (let i = 0; i < 6; i++) {
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
      
      // Initialize
      createParticles();
      setInterval(createParticles, 8000);
    `;
  }
}