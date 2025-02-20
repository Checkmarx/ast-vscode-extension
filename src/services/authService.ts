import * as vscode from 'vscode';
import * as http from 'http';
import * as crypto from 'crypto';
import { URL, URLSearchParams } from 'url';
import fetch from 'node-fetch';
import { CxWrapper } from "@checkmarxdev/ast-cli-javascript-wrapper";
import { CxConfig } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import { Logs } from '../models/logs';
import { initialize, getCx } from '../cx';

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
    private context: vscode.ExtensionContext;
    private constructor(extensionContext: vscode.ExtensionContext) {
        this.context = extensionContext;
        initialize(extensionContext);
    }

    public static getInstance(extensionContext: vscode.ExtensionContext): AuthService {
        if (!this.instance) {
            this.instance = new AuthService(extensionContext);
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
            // Check if base URI exists
            const baseCheck = await fetch(baseUri);
            if (!baseCheck.ok) {
                return { 
                    isValid: false, 
                    error: "Invalid Base URI. Please check your server address."
                };
            }
    
            // Check if tenant exists
            const tenantCheck = await fetch(`${baseUri}/auth/realms/${tenant}`);
            if (tenantCheck.status === 404) {
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
            scope: 'openid',
            codeVerifier,
            codeChallenge,
            port
        };
    
        try {
            const server = await this.startLocalServer(config);
            vscode.env.openExternal(vscode.Uri.parse(
                `${config.authEndpoint}?` +
                `client_id=${config.clientId}&` +
                `redirect_uri=${encodeURIComponent(config.redirectUri)}&` +
                `response_type=code&` +
                `scope=${config.scope}&` +
                `code_challenge=${config.codeChallenge}&` +
                `code_challenge_method=S256`
            ));
    
            const code = await this.waitForCode(server);
            const token = await this.getRefreshToken(code, config);
            console.log("Got refresh token:", token ? "Token exists" : "No token");
            
            await this.saveToken(this.context, token);
            console.log("Token saved after authentication");
            
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

    private waitForCode(server: http.Server): Promise<string> {
        return new Promise((resolve, reject) => {
            server.on('request', (req, res) => {
                const url = new URL(req.url!, `http://${req.headers.host}`);
                const code = url.searchParams.get('code');
                if (code) {
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('Authentication successful! You can close this window.');
                    server.close();
                    resolve(code);
                } else {
                    reject(new Error('No authorization code received'));
                }
            });
        });
    }

    public async validateApiKey(apiKey: string): Promise<boolean> {
        try {
            const config = new CxConfig();
            config.apiKey = apiKey;
            
            const cx = new CxWrapper(config);
            const valid = await cx.authValidate();
            
            return valid.exitCode === 0;
        } catch (error) {
            return false;
        }
    }

    private async getRefreshToken(code: string, config: OAuthConfig): Promise<string> {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', config.clientId);
        params.append('code', code);
        params.append('redirect_uri', config.redirectUri);
        params.append('code_verifier', config.codeVerifier);

        const response = await fetch(config.tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        if (!response.ok) {
            throw new Error(`Token exchange failed: ${response.statusText}`);
        }

        const data = await response.json();
        return data.refresh_token;
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
        console.log("Attempting to save token:", token ? "Token exists" : "No token provided");
        
        await this.context.secrets.store("authCredential", token);
        console.log("Token stored in secrets");
        
        // Verify the token was saved
        const savedToken = await this.context.secrets.get("authCredential");
        console.log("Verification - Retrieved token:", savedToken ? "Token exists" : "No token found");
        
        const isValid = await this.validateAndUpdateState();
        console.log("Token validation result:", isValid);
        
        if (isValid) {
            vscode.window.showInformationMessage("Token saved and validated successfully!");
        } else {
            vscode.window.showErrorMessage("Token validation failed!");
        }
    }

    public async validateAndUpdateState(): Promise<boolean> {
        try {
            const token = await this.context.secrets.get("authCredential");
            if (!token) {
                return false;
            }

            const isValid = await this.validateApiKey(token);
            
            vscode.commands.executeCommand(
                'setContext',
                'ast-results.isValidCredentials',
                isValid
            );

            if (isValid) {
                const cx = getCx();
                const scanEnabled = await cx.isScanEnabled(new Logs(vscode.window.createOutputChannel("Checkmarx")));
                
                vscode.commands.executeCommand(
                    'setContext',
                    'ast-results.isScanEnabled',
                    scanEnabled
                );
            }

            return isValid;
        } catch (error) {
            console.error('Validation error:', error);
            return false;
        }
    }

    // public async isValidateToken(): Promise<boolean> {
    //     try {
    //         const token = await this.context.secrets.get("authCredential");
    //         //TODO: validate token
    //         if (!token) {
    //             return false;
    //         }
    //         return true;
    //     } catch (error) {
    //         console.error('Validation error:', error);
    //         return false;
    //     }
    // }

    public async getToken(): Promise<string | undefined> {
        return await this.context.secrets.get("authCredential");
    }

    public async logout(): Promise<void> {
       
        // Verify the token was saved
        const savedToken = await this.context.secrets.get("authCredential");
        console.log("Verification - Retrieved token:", savedToken ? "Token exists" : "No token found");

        // Delete only the token
        await this.context.secrets.delete("authCredential");

        // Check and log the current token
        const aftercurrentToken = await this.getToken();
        console.log("after remove token after logout:", aftercurrentToken);
        

        // Update UI state to reflect logged out status
        await vscode.commands.executeCommand(
            'setContext',
            'ast-results.isValidCredentials',
            false
        );
        
  
    }
}
