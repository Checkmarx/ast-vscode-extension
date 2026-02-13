import * as vscode from 'vscode';
import * as http from 'http';
import * as crypto from 'crypto';
import { URL, URLSearchParams } from 'url';
import { Logs } from '../models/logs';
import { getCx, initialize } from '../cx';
import { commands } from "../utils/common/commandBuilder";
import { constants } from "../utils/common/constants";
import { ProxyHelper } from '../utils/proxy/proxy';
import axios from "axios";
import { getExtensionType, EXTENSION_TYPE } from '../config/extensionConfig';
import { getMessages } from '../config/extensionMessages';

interface OAuthConfig {
  clientId: string;
  authEndpoint: string;
  tokenEndpoint: string;
  redirectUri: string;
  scope: string;
  codeVerifier: string;
  codeChallenge: string;
  port: number;
}

export class AuthService {
  private static instance: AuthService;
  private server: http.Server | null = null;
  private readonly context: vscode.ExtensionContext;
  private readonly logs: Logs | undefined;
  private constructor(extensionContext: vscode.ExtensionContext, logs?: Logs) {
    this.logs = logs;
    this.context = extensionContext;
    initialize(extensionContext);
  }

  public static getInstance(extensionContext: vscode.ExtensionContext, logs?: Logs): AuthService {
    if (!this.instance) {
      this.instance = new AuthService(extensionContext, logs);
    }
    return this.instance;
  }

  private async closeServer(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server?.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }

  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(64).toString('hex');
    const hashed = crypto.createHash('sha256').update(codeVerifier).digest('base64');
    const codeChallenge = hashed.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return { codeVerifier, codeChallenge };
  }

  private async validateConnection(baseUri: string, tenant: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      // Basic URL validation
      const url = new URL(baseUri);

      if (!url.protocol.startsWith('http')) {
        return {
          isValid: false,
          error: "Invalid URL protocol. Please use http:// or https://"
        };
      }

      if (!tenant || tenant.trim() === '') {
        return {
          isValid: false,
          error: "Tenant name cannot be empty"
        };
      }

      // Step 3: Check proxy reachability before proceeding with server checks
      const proxyHelper = new ProxyHelper();
      const isProxyReachable = await proxyHelper.checkProxyReachability(baseUri);
      if (!isProxyReachable) {
        return {
          isValid: false,
          error: "Unable to reach the proxy server. Please verify your proxy settings and try again."
        };
      }

      try {
        // Basic connectivity check to server
        const isBaseUriValid = await this.checkUrlExists(baseUri, false);
        if (!isBaseUriValid) {
          return {
            isValid: false,
            error: "Please check the server address of your Checkmarx One environment."
          };
        }
      }
      catch (error) {
        return {
          isValid: false,
          error: "Could not connect to server. Please check your Base URI.",
        };
      }

      // Check if tenant exists
      const tenantUrl = `${baseUri}/auth/realms/${tenant}`;
      const isTenantValid = await this.checkUrlExists(tenantUrl.replace(/([^:]\/)\/+/g, '$1'), true);
      if (!isTenantValid) {
        return {
          isValid: false,
          error: `Tenant "${tenant}" not found. Please check your tenant name.`
        };
      }
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: "Could not connect to server. Please check your Base URI."
      };
    }
  }

  // Helper function to check if a URL exists
  private async checkUrlExists(urlToCheck: string, isTenantCheck = false): Promise<boolean> {
    try {
      const proxyHelper = new ProxyHelper();
      const agent = proxyHelper.createHttpsProxyAgent();

      const config = {
        url: urlToCheck,
        method: 'GET',
        timeout: 15000,
        maxRedirects: 5,
        httpsAgent: agent,
        httpAgent: agent,
        validateStatus: () => true // don't throw for non-2xx
      };

      const res = await axios.request(config);

      if (isTenantCheck && (res.status === 404 || res.status === 405)) {
        console.log(`Tenant check failed with ${res.status}:`, res.data);
        return false;
      }

      return res.status < 400;
    } catch (error) {
      console.error('Request error in checkUrlExists:', error.message);
      return false;
    }
  }

  private async findAvailablePort(): Promise<number> {
    const MIN_PORT = 49152;
    const MAX_PORT = 65535;
    const maxAttempts = 10;  // Limit the number of attempts


    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Selecting a random port from the range
      const port = Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1) + MIN_PORT);

      try {
        // Checking if the port is available
        await new Promise((resolve, reject) => {
          const server = http.createServer();
          server.on('error', reject);
          server.listen(port, () => {
            server.close(() => resolve(true));
          });
        });

        return port;
      } catch (error) {
        // If the port is occupied, we will proceed to the next attempt
        continue;
      }
    }

    throw new Error('Could not find available port after multiple attempts');
  }

  public async authenticate(baseUri: string, tenant: string): Promise<string> {
    await this.closeServer();
    const validation = await this.validateConnection(baseUri, tenant);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    const port = await this.findAvailablePort();

    const { codeVerifier, codeChallenge } = this.generatePKCE();
    const config: OAuthConfig = {
      clientId: 'ide-integration',
      authEndpoint: `${baseUri}/auth/realms/${tenant}/protocol/openid-connect/auth`,
      tokenEndpoint: `${baseUri}/auth/realms/${tenant}/protocol/openid-connect/token`,
      redirectUri: `http://localhost:${port}/checkmarx1/callback`,
      scope: 'openid offline_access',
      codeVerifier,
      codeChallenge,
      port
    };

    try {
      const server = await this.startLocalServer(config);

      const authUrl = `${config.authEndpoint}?` +
        `client_id=${config.clientId}&` +
        `redirect_uri=${encodeURIComponent(config.redirectUri)}&` +
        `response_type=code&` +
        `scope=${config.scope}&` +
        `code_challenge=${config.codeChallenge}&` +
        `code_challenge_method=S256`;

      const opened = await vscode.env.openExternal(vscode.Uri.parse(authUrl));
      if (!opened) {
        server.close();
        return "";
      }
      const { code, res } = await this.waitForCode(server);
      const token = await this.getRefreshToken(code, config);
      // Save token
      await this.saveToken(this.context, token);
      console.log("Token saved after authentication");

      // Check if validation was successful before showing success page
      const isValid = await this.validateAndUpdateState();

      if (isValid) {
        // Only show success page if token is valid
        res.end(this.getSuccessPageHtml());
      } else {
        // Show error page if token validation failed
        res.end(this.getErrorPageHtml("Token validation failed. Please try again."));
      }

      await this.saveURIAndTenant(this.context, baseUri, tenant);
      console.log("URI and tenant saved");

      return token;
    } catch (error) {
      console.error("Authentication error:", error);
      throw error;
    }
  }
  private startLocalServer(config: OAuthConfig): Promise<http.Server> {
    return new Promise((resolve, reject) => {
      try {
        const server = http.createServer();
        server.on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
            reject(new Error(`Port ${config.port} is already in use. Please try again in a few moments.`));
          } else {
            reject(err);
          }
        });

        server.listen(config.port, () => {
          resolve(server);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  private waitForCode(server: http.Server): Promise<{ code: string, res: http.ServerResponse }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error('Timeout waiting for authorization code'));
      }, 60000); // 60 seconds timeout

      server.on('request', (req, res) => {
        clearTimeout(timeout);
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');

        if (code) {
          // Don't end the response yet - just prepare headers
          res.writeHead(200, { 'Content-Type': 'text/html' });

          // Only close the server, keep the response open
          server.close();

          // Return both code and response object
          resolve({ code, res });
        } else {
          // For error cases, we can end the response immediately
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Error: No authorization code received</h1></body></html>');
          server.close();
          reject(new Error('No authorization code received'));
        }
      });
    });
  }

  public async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      await this.context.secrets.store(constants.getAuthCredentialSecretKey(), apiKey);
      const cx = getCx();
      return await cx.authValidate(this.logs);

    } catch (error) {
      return false;
    }
  }

  private async getRefreshToken(code: string, config: OAuthConfig): Promise<string> {
    try {
      const proxyHelper = new ProxyHelper();
      const agent = proxyHelper.createHttpsProxyAgent();

      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: config.codeVerifier
      });

      const res = await axios.post(
        config.tokenEndpoint,
        params.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          maxRedirects: 5,
          httpsAgent: agent,
          httpAgent: agent
        }
      );

      if (!res.data?.refresh_token) {
        throw new Error('Response did not include refresh token');
      }

      return res.data.refresh_token;
    } catch (err) {
      throw new Error(`Failed to fetch refresh token: ${err.message}`);
    }
  }


  private async saveURIAndTenant(context: vscode.ExtensionContext, url: string, tenant: string): Promise<void> {
    const urlMap = context.globalState.get<{ [key: string]: string[] }>("recentURLsAndTenant") || {};

    const urls = Object.keys(urlMap);

    if (!urlMap[url]) {
      if (urls.length >= 10) {
        delete urlMap[urls[0]];
      }
      urlMap[url] = [];
    }

    if (!urlMap[url].includes(tenant)) {
      urlMap[url].push(tenant);
    }

    await context.globalState.update("recentURLsAndTenant", urlMap);
  }

  public async saveToken(context: vscode.ExtensionContext, token: string) {
    await this.context.secrets.store(constants.getAuthCredentialSecretKey(), token);
    console.log("Token stored in secrets");
    const isValid = await this.validateAndUpdateState();
    console.log("Token validation result:", isValid);

    if (isValid) {
      vscode.window.showInformationMessage(getMessages().authSuccessMessage);
      // Only refresh tree for Checkmarx extension (not Developer Assist)
      if (getExtensionType() === EXTENSION_TYPE.CHECKMARX) {
        await vscode.commands.executeCommand(commands.refreshTree);
        await vscode.commands.executeCommand(commands.refreshDastTree);
      }
      await vscode.commands.executeCommand(commands.updateCxOneAssist);
    }

  }

  public async validateAndUpdateState(): Promise<boolean> {
    try {
      const token = await this.context.secrets.get(constants.getAuthCredentialSecretKey());

      if (!token) {
        vscode.commands.executeCommand(
          commands.setContext,
          commands.isValidCredentials,
          false
        );
        vscode.commands.executeCommand(
          commands.setContext,
          commands.isScanEnabled,
          false
        );
        return false;
      }
      const isValid = await this.validateApiKey(token);
      vscode.commands.executeCommand(
        commands.setContext,
        commands.isValidCredentials,
        isValid
      );

      if (isValid) {
        const cx = getCx();
        const scanEnabled = await cx.isScanEnabled(this.logs);

        vscode.commands.executeCommand(
          commands.setContext,
          commands.isScanEnabled,
          scanEnabled
        );
      }

      return isValid;
    } catch (error) {
      console.error('Validation error:', error);
      return false;
    }
  }

  public async getToken(): Promise<string | undefined> {
    return await this.context.secrets.get(constants.getAuthCredentialSecretKey());
  }

  public async logout(): Promise<void> {
    // Delete only the token
    await this.context.secrets.delete(constants.getAuthCredentialSecretKey());
    await this.context.globalState.update(constants.getStandaloneEnabledGlobalState(), undefined);

    await this.validateAndUpdateState();
    // Only refresh tree for Checkmarx extension (not Developer Assist)
    if (getExtensionType() === EXTENSION_TYPE.CHECKMARX) {
      await vscode.commands.executeCommand(commands.refreshTree);
      await vscode.commands.executeCommand(commands.refreshDastTree);
      await vscode.commands.executeCommand(commands.clear);
      await vscode.commands.executeCommand(commands.clearDast);
    }

    await vscode.commands.executeCommand(commands.updateCxOneAssist);
    await vscode.commands.executeCommand(
      commands.setContext,
      commands.isStandaloneEnabled,
      false);
  }

  private getSuccessPageHtml(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Login Success - Checkmarx</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  background-color: rgba(0, 0, 0, 0.5);
                  margin: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
              }
              .modal {
                  background: white;
                  padding: 2rem;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                  width: 90%;
                  max-width: 500px;
                  text-align: center;
              }
              .close-button {
                  float: right;
                  font-size: 24px;
                  color: #666;
                  cursor: pointer;
                  border: none;
                  background: none;
                  padding: 0;
                  margin: -1rem -1rem 0 0;
              }
              h1 {
                  color: #333;
                  font-size: 24px;
                  margin: 1rem 0;
              }
              .icon-container {
                  margin: 2rem 0;
              }
              .icon {
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  gap: 10px;
              }
              .folder {
                  color: #6B4EFF;
                  font-size: 48px;
              }
              .file {
                  color: #6B4EFF;
                  font-size: 48px;
              }
              .message {
                  color: #666;
                  margin: 1rem 0 2rem 0;
              }
              .success-note {
                  color: #4F5CD1;
                  font-size: 16px;
                  margin: 2rem 0;
              }
              .wave-line {
                  color: #6B4EFF;
                  font-size: 24px;
                  margin: 0 10px;
              }
          </style>
      </head>
      <body>
          <div class="modal">
              <h1>You're All Set with Checkmarx!</h1>
              <div class="icon-container">
                  <div class="icon">
                      <span class="folder">📁</span>
                      <span class="wave-line">〰️〰️〰️</span>
                      <span class="file">📄</span>
                  </div>
              </div>
              <p class="message">You're Connected to Checkmarx!</p>
              <p class="message">You can close this window</p>
          </div>
      </body>
      </html>
      `;
  }
  private getErrorPageHtml(errorMessage: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Login Failed - Checkmarx</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  background-color: rgba(0, 0, 0, 0.5);
                  margin: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
              }
              .modal {
                  background: white;
                  padding: 2rem;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                  width: 90%;
                  max-width: 500px;
                  text-align: center;
              }
              .close-button {
                  float: right;
                  font-size: 24px;
                  color: #666;
                  cursor: pointer;
                  border: none;
                  background: none;
                  padding: 0;
                  margin: -1rem -1rem 0 0;
              }
              h1 {
                  color: #333;
                  font-size: 24px;
                  margin: 1rem 0;
              }
              .icon-container {
                  margin: 2rem 0;
              }
              .error-icon {
                  font-size: 48px;
                  color: #FF4D4F;
              }
              .message {
                  color: #666;
                  margin: 1rem 0 2rem 0;
              }
              .close-btn {
                  background-color: #4F5CD1;
                  color: white;
                  border: none;
                  padding: 12px 40px;
                  border-radius: 4px;
                  font-size: 16px;
                  cursor: pointer;
                  transition: background-color 0.3s;
              }
              .close-btn:hover {
                  background-color: #3F4BB1;
              }
          </style>
      </head>
      <body>
          <div class="modal">
              <h1>Authentication Failed</h1>
              <div class="icon-container">
                  <span class="error-icon">❌</span>
              </div>
              <p class="message">${errorMessage}</p>
          </div>
      </body>
      </html>
      `;
  }
}
