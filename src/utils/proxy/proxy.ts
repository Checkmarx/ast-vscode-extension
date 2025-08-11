import * as vscode from 'vscode';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as http from 'http';
import * as https from 'https';
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
		if (!this.additionalParams.trim()) {
			this.parseAdditionalParams();
		}
		if (!this.extensionProxy) {
			this.vscodeProxy = vscode.workspace.getConfiguration().get<string>('http.proxy');
			this.strictSSL = vscode.workspace.getConfiguration().get<boolean>('http.proxyStrictSSL', true);
		}

		if (!this.vscodeProxy) {
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
			strictSSL: this.extensionProxy ? false : this.strictSSL,
			proxyAuthType: this.proxyAuthType,
			proxyNtlmDomain: this.proxyNtlmDomain,
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
				resolve(true);
			}

			// Parse the proxy URL
			const parsedProxy = url.parse(proxy);

			// Choose http or https depending on the target URL
			const requestFn = targetUrl.startsWith('https') ? https.request : http.request;

			// Setup request options for the proxy
			const options = {
				hostname: parsedProxy.hostname,
				port: parsedProxy.port || 8080, // Default port for proxy
				path: targetUrl,
				method: 'GET',
				headers: {
					Host: new URL(targetUrl).hostname
				}
			};

			const req = requestFn(options, (res) => {
				if (res.statusCode === 200) {
					resolve(true);  // Proxy is reachable and the target is reachable
				} else {
					resolve(false);
					console.error(`Proxy responded with status code: ${res.statusCode}`);
				}
			});

			req.on('error', (err) => {
				console.error(`Error connecting to proxy: ${err.message}`);
				resolve(false);
			});

			req.end();
		});
	}
}
