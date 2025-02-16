import * as vscode from 'vscode';
import * as http from 'http';
import * as crypto from 'crypto';
import { URL, URLSearchParams } from 'url';
import fetch from 'node-fetch';

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
    private constructor() {}

    public static getInstance(): AuthService {
        if (!this.instance) {
            this.instance = new AuthService();
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
        const maxAttempts = 10;  // הגבלת מספר הניסיונות
    
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // בחירת פורט רנדומלי מהטווח
            const port = Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1) + MIN_PORT);
            
            try {
                // בדיקה אם הפורט פנוי
                await new Promise((resolve, reject) => {
                    const server = http.createServer();
                    server.on('error', reject);
                    server.listen(port, () => {
                        server.close(() => resolve(true));
                    });
                });
                
                return port;
            } catch (error) {
                // אם הפורט תפוס, נמשיך לניסיון הבא
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
            const token = await this.getToken(code, config);
    
            await vscode.workspace.getConfiguration().update(
                'checkmarxOne.apiKey',
                token,
                vscode.ConfigurationTarget.Global
            );
    
            return token;
        } catch (error) {
            await this.closeServer();
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }
    private startLocalServer(config: OAuthConfig): Promise<http.Server> {
        return new Promise((resolve) => {
             this.server = http.createServer();
            this.server.listen(2000, () => resolve(this.server));
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

    private async getToken(code: string, config: OAuthConfig): Promise<string> {
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
        return data.access_token;
    }
}
