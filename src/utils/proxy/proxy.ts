import * as vscode from 'vscode';
import { HttpsProxyAgent } from 'https-proxy-agent';
import tls from 'tls';
import net from 'net';
import * as url from 'url';


interface ProxyConfig {
	proxy?: string;
	strictSSL: boolean;
	proxyAuthType?: string; // basic or ntlm
	proxyNtlmDomain?: string;
}

export class ProxyHelper {
	private envProxy: string | undefined;
	private vscodeProxy: string | undefined;
	private strictSSL: boolean;
	private additionalParams: string;
	private extensionProxy: string | undefined;
	private proxyAuthType: string | undefined;
	private proxyNtlmDomain: string | undefined;

	constructor() {
		this.additionalParams = vscode.workspace.getConfiguration().get<string>('checkmarxOne.additionalParams') || '';
		if (this.additionalParams.trim()) {
			this.parseAdditionalParams();
		}
		if (!this.extensionProxy) {
			this.vscodeProxy = vscode.workspace.getConfiguration().get<string>('http.proxy');
			if (this.vscodeProxy && this.vscodeProxy !== "")
				this.strictSSL = vscode.workspace.getConfiguration().get<boolean>('http.proxyStrictSSL', false);
		}

		if (!this.extensionProxy && !this.vscodeProxy) {
			this.envProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
		}
	}

	private parseAdditionalParams(): void {
		const tokens = this.additionalParams.split(/\s+/); // split by whitespace
		for (let i = 0; i < tokens.length; i++) {
			switch (tokens[i]) {
				case '--proxy':
					this.extensionProxy = tokens[i + 1];
					i++;
					break;
				case '--proxy-auth-type':
					this.proxyAuthType = tokens[i + 1];
					i++;
					break;
				case '--proxy-ntlm-domain':
					this.proxyNtlmDomain = tokens[i + 1];
					i++;
					break;
			}
		}
	}

	/**
	 * Retrieves the proxy configuration in the following priority:
	 *  1. Extension-specific "additional parameters" setting (`checkmarxOne.additionalParams`)
	 *  2. VS Code's `http.proxy` setting
	 *  3. Environment variables `HTTPS_PROXY` or `HTTP_PROXY`
	 */
	public getProxyConfig(): ProxyConfig {
		return {
			proxy: this.extensionProxy || this.vscodeProxy || this.envProxy || undefined,
			strictSSL: this.strictSSL,
			proxyAuthType: this.extensionProxy ? this.proxyAuthType : undefined,
			proxyNtlmDomain: this.extensionProxy ? this.proxyNtlmDomain : undefined,
		};
	}

	/**
	 * Creates an HttpsProxyAgent using the proxy configuration retrieved
	 * from VS Code settings, environment variables, or extension-specific options.
	 */
	public createHttpsProxyAgent(): HttpsProxyAgent<string> | undefined {
		const { proxy, strictSSL, proxyAuthType, proxyNtlmDomain } = this.getProxyConfig();

		if (!proxy) { return undefined; }

		const agentOptions: Record<string, unknown> = {
			rejectUnauthorized: strictSSL,
		};

		if (proxyAuthType) {
			agentOptions['authType'] = proxyAuthType;
		}

		if (proxyAuthType?.toLowerCase() === 'ntlm' && proxyNtlmDomain) {
			agentOptions['ntlmDomain'] = proxyNtlmDomain;
		}

		return new HttpsProxyAgent(proxy, agentOptions);
	}

	/**
   * Checks if the proxy is reachable by making an HTTP/HTTPS request to a target URL through the proxy.
   */
	public checkProxyReachability(targetUrl: string): Promise<boolean> {
		return new Promise((resolve) => {
			const { proxy } = this.getProxyConfig();
			if (!proxy) {
				// No proxy configured → treat as reachable
				resolve(true);
				return;
			}

			const parsedProxy = url.parse(proxy);
			const target = new URL(targetUrl);

			// Connect to proxy via TCP socket
			const socket = net.connect(
				{
					host: parsedProxy.hostname,
					port: Number(parsedProxy.port) || 8080,
				},
				() => {
					// Send CONNECT request to proxy to open tunnel to target
					socket.write(
						`CONNECT ${target.hostname}:443 HTTP/1.1\r\n` +
						`Host: ${target.hostname}:443\r\n` +
						`Connection: close\r\n\r\n`
					);
				}
			);

			socket.setEncoding('utf8');

			let responseBuffer = '';

			socket.on('data', (chunk) => {
				responseBuffer += chunk;

				if (responseBuffer.indexOf('\r\n\r\n') !== -1) {
					if (/^HTTP\/1\.[01] 200/.test(responseBuffer)) {
						// Tunnel established, upgrade to TLS socket to confirm HTTPS handshake
						const tlsSocket = tls.connect(
							{
								socket: socket,
								servername: target.hostname,
							},
							() => {
								// Success: proxy reachable & tunnel works
								resolve(true);
								tlsSocket.end();
							}
						);

						tlsSocket.on('error', (err) => {
							console.error(`TLS handshake error: ${err.message}`);
							resolve(false);
						});
					} else {
						// Proxy rejected CONNECT request
						console.error(`Proxy CONNECT failed: ${responseBuffer.split('\r\n')[0]}`);
						resolve(false);
						socket.end();
					}

					socket.removeAllListeners('data');
				}
			});

			socket.on('error', (err) => {
				console.error(`Proxy connection error: ${err.message}`);
				resolve(false);
			});

			// Timeout to prevent hanging if proxy doesn’t respond
			socket.setTimeout(5000, () => {
				console.error('Proxy connection timed out');
				socket.destroy();
				resolve(false);
			});
		});
	}
}
