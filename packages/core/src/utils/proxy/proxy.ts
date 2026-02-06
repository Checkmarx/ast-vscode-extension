import * as vscode from "vscode";
import { HttpsProxyAgent } from "https-proxy-agent";
import axios from "axios";

interface ProxyConfig {
	proxy?: string;
	strictSSL: boolean;
	proxyAuthType?: string; // basic or ntlm
	proxyNtlmDomain?: string;
}

export class ProxyHelper {
	private envProxy: string | undefined;
	private vscodeProxy: string | undefined;
	private strictSSL: boolean = false;
	private additionalParams: string;
	private extensionProxy: string | undefined;
	private proxyAuthType: string | undefined;
	private proxyNtlmDomain: string | undefined;

	constructor() {
		this.additionalParams =
			vscode.workspace
				.getConfiguration()
				.get<string>("checkmarxOne.additionalParams") || "";

		if (this.additionalParams.trim()) {
			this.parseAdditionalParams();
		}

		if (!this.extensionProxy) {
			this.vscodeProxy = vscode.workspace
				.getConfiguration()
				.get<string>("http.proxy");
			if (this.vscodeProxy && this.vscodeProxy !== "") {
				this.strictSSL = vscode.workspace
					.getConfiguration()
					.get<boolean>("http.proxyStrictSSL", false);
			}
		}

		if (!this.extensionProxy && !this.vscodeProxy) {
			this.envProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
		}
	}

	private parseAdditionalParams(): void {
		const tokens = this.additionalParams.split(/\s+/); // split by whitespace
		for (let i = 0; i < tokens.length; i++) {
			switch (tokens[i]) {
				case "--proxy":
					this.extensionProxy = tokens[i + 1];
					i++;
					break;
				case "--proxy-auth-type":
					this.proxyAuthType = tokens[i + 1];
					i++;
					break;
				case "--proxy-ntlm-domain":
					this.proxyNtlmDomain = tokens[i + 1];
					i++;
					break;
			}
		}
	}

	public getProxyConfig(): ProxyConfig {
		return {
			proxy: this.extensionProxy || this.vscodeProxy || this.envProxy,
			strictSSL: this.strictSSL,
			proxyAuthType: this.extensionProxy ? this.proxyAuthType : undefined,
			proxyNtlmDomain: this.extensionProxy ? this.proxyNtlmDomain : undefined,
		};
	}

	/**
	 * Creates an HttpsProxyAgent for Axios.
	 */
	public createHttpsProxyAgent(): HttpsProxyAgent<string> | undefined {
		const { proxy, strictSSL, proxyAuthType, proxyNtlmDomain } =
			this.getProxyConfig();

		if (!proxy) {
			return undefined;
		}

		const agentOptions: Record<string, unknown> = {
			rejectUnauthorized: strictSSL,
		};

		if (proxyAuthType) {
			agentOptions["authType"] = proxyAuthType;
		}

		if (proxyAuthType?.toLowerCase() === "ntlm" && proxyNtlmDomain) {
			agentOptions["ntlmDomain"] = proxyNtlmDomain;
		}

		return new HttpsProxyAgent(proxy, agentOptions);
	}

	/**
	 * Checks if the proxy is reachable by making a simple Axios request
	 * through it instead of raw net/tls.
	 */
	public async checkProxyReachability(targetUrl: string): Promise<boolean> {
		const { proxy } = this.getProxyConfig();
		if (!proxy) {
			return true; // no proxy → assume reachable
		}

		try {
			const agent = this.createHttpsProxyAgent();

			const response = await axios.get(targetUrl, {
				httpsAgent: agent,
				proxy: false, // disable axios' own proxy option, we use custom agent
				timeout: 5000,
				validateStatus: () => true, // don’t throw on 4xx/5xx
			});

			// If proxy works, we should get some status back
			return response.status > 0;
		} catch (err) {
			console.error(`Proxy reachability check failed: ${err.message}`);
			return false;
		}
	}
}