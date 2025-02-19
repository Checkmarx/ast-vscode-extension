import * as vscode from 'vscode';
import { AuthService } from '../services/authService';

export class AuthenticationWebview {
    public static readonly viewType = 'checkmarxAuth';
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private static readonly HISTORY_KEY = 'checkmarxOne.history'; // Key for storing history
    public static readonly API_KEY_HISTORY_KEY = 'checkmarxOne.apiKeyHistory';

    
    private constructor(panel: vscode.WebviewPanel, private context: vscode.ExtensionContext) {
        this._panel = panel;
        this._panel.webview.html = this._getWebviewContent();
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static show(context: vscode.ExtensionContext) {
        const panel = vscode.window.createWebviewPanel(
            AuthenticationWebview.viewType,
            'Checkmarx One Authentication',
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        return new AuthenticationWebview(panel, context);
    }

    private _getWebviewContent(): string {
        const history = this.context.globalState.get<string[]>(AuthenticationWebview.HISTORY_KEY, []);
        const options = history.map(uri => `<option value="${uri}">${uri}</option>`).join('');
        
        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Checkmarx One Authentication</title>
            <style>
                body {
                    display: flex;
                    align-items: flex-start;
                    justify-content: flex-start;
                    height: 100vh;
                    background-color: var(--vscode-editor-background);
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    padding: 20px;
                }
                .auth-container {
                    width: 400px;
                    padding: 20px;
                    background: var(--vscode-input-background);
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                    text-align: center;
                }
                .radio-group {
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                    margin-bottom: 15px;
                }
                .input-field {
                    width: 100%;
                    padding: 8px;
                    margin-bottom: 10px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 5px;
                }
                button {
                    width: 100%;
                    padding: 10px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 10px;
                }
                .hidden {
                    display: none;
                }
                .message {
                    margin-top: 10px;
                    padding: 10px;
                    border-radius: 5px;
                    display: none;
                }
                
                .error-message {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    color: var(--vscode-inputValidation-errorForeground);
                }
                
                .success-message {
                    background-color: var(--vscode-inputValidation-infoBackground);
                    border: 1px solid var(--vscode-inputValidation-infoBorder);
                    color: var(--vscode-inputValidation-infoForeground);
                }
            </style>
        </head>
        <body>
            <div class="auth-container">
                <h3>Checkmarx One Authentication</h3>
                
                <div class="radio-group">
                    <label>
                        <input type="radio" name="authMethod" value="oauth" checked>
                        By OAuth
                    </label>
                    <label>
                        <input type="radio" name="authMethod" value="apiKey">
                        By API KEY
                    </label>
                </div>
    
                <div id="oauthForm">
                    <select id="baseUriDropdown" class="input-field">
                        <option value="">Select Base URI</option>
                        ${options}
                    </select>
                    <input type="text" id="baseUri" placeholder="Or enter Base URI manually" class="input-field">
                    <input type="text" id="tenant" placeholder="Enter Tenant Name" class="input-field">
                </div>
    
                <div id="apiKeyForm" class="hidden">
                    <input type="password" id="apiKey" placeholder="Enter Checkmarx One API KEY" class="input-field">
                </div>
    
                <button id="authButton">Sign in to Checkmarx</button>
                
                <div id="messageBox" class="message"></div>
            </div>
    
            <script>
                const vscode = acquireVsCodeApi();
                const authButton = document.getElementById('authButton');
                const messageBox = document.getElementById('messageBox');
                
                document.querySelectorAll('input[name="authMethod"]').forEach(radio => {
                    radio.addEventListener('change', (e) => {
                        const isOAuth = e.target.value === 'oauth';
                        document.getElementById('oauthForm').classList.toggle('hidden', !isOAuth);
                        document.getElementById('apiKeyForm').classList.toggle('hidden', isOAuth);
                        authButton.textContent = isOAuth ? 'Sign in to Checkmarx' : 'Validate Connection';
                    });
                });
    
                authButton.addEventListener('click', () => {
                    const authMethod = document.querySelector('input[name="authMethod"]:checked').value;
                    const baseUri = document.getElementById('baseUri').value || document.getElementById('baseUriDropdown').value;
                    const tenant = document.getElementById('tenant').value;
                    const apiKey = document.getElementById('apiKey').value;
                    
                    vscode.postMessage({ 
                        command: 'authenticate', 
                        authMethod, 
                        baseUri,
                        tenant,
                        apiKey 
                    });
                });

                // Listening for messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    messageBox.textContent = message.message;
                    messageBox.style.display = 'block';
                    messageBox.className = 'message ' + 
                        (message.type === 'validation-error' ? 'error-message' : 'success-message');
                });
            </script>
        </body>
        </html>`;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(async message => {
            if (message.command === 'authenticate') {
                try {
                    if (message.authMethod === 'oauth') {
                        // Existing OAuth handling
                        const authService = AuthService.getInstance();
                        await authService.authenticate(message.baseUri, message.tenant);
                        await this._saveBaseUri(message.baseUri);
                        vscode.window.showInformationMessage('Successfully authenticated with Checkmarx One!');
                        this._panel.dispose();

                    } else if (message.authMethod === 'apiKey') {
                        const authService = AuthService.getInstance();
                        
                        // Validating the API Key
                        const isValid = await authService.validateApiKey(message.apiKey);
                        
                        if (!isValid) {
                            // Sending an error message to the window
                            this._panel.webview.postMessage({ 
                                type: 'validation-error',
                                message: 'API Key validation failed. Please check your key.'
                            });
                            return;
                        }

                        // If valid, saving in the configuration
                        await this._saveApiKey(message.apiKey);


                        // Sending a success message to the window
                        this._panel.webview.postMessage({ 
                            type: 'validation-success',
                            message: 'API Key validated successfully!'
                        });

                        // Closing the window after one second
                        setTimeout(() => this._panel.dispose(), 1000);
                    }
                } catch (error) {
                    this._panel.webview.postMessage({ 
                        type: 'validation-error',
                        message: `Authentication failed: ${error.message}`
                    });
                }
            }
        }, undefined, this._disposables);
    }

    private async _saveBaseUri(uri: string) {
        if (!uri) {return;}
        let history = this.context.globalState.get<string[]>(AuthenticationWebview.HISTORY_KEY, []);
        if (!history.includes(uri)) {
            history.unshift(uri);
            if (history.length > 10) {history = history.slice(0, 10);}
            await this.context.globalState.update(AuthenticationWebview.HISTORY_KEY, history);
        }
    }


    private async _saveApiKey(apiKey: string) {
        await vscode.workspace.getConfiguration().update(
            'checkmarxOne.apiKey',
            apiKey,
            vscode.ConfigurationTarget.Workspace
        );
    
            // Retrieve and log the current API key from globalState before update
        const currentApiKey = this.context.globalState.get<string>(AuthenticationWebview.API_KEY_HISTORY_KEY, "");
        console.log("API Key in globalState BEFORE update:", currentApiKey);

        // Save only the latest API key (overwrite any existing value)
        await this.context.globalState.update(AuthenticationWebview.API_KEY_HISTORY_KEY, apiKey);

        // Retrieve and log the updated API key from globalState after update
        const updatedApiKey = this.context.globalState.get<string>(AuthenticationWebview.API_KEY_HISTORY_KEY, "");
        console.log("API Key in globalState AFTER update:", updatedApiKey);
    }
    

    public dispose() {
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
