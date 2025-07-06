import * as vscode from "vscode";
import { jwtDecode } from "jwt-decode";

interface DecodedJwt {
	iss: string;
}

interface McpServer {
	url: string;
	headers: {
		"cx-origin": string;
		Authorization: string;
	};
}

interface McpConfig {
	servers?: Record<string, McpServer>;
}

function decodeJwt(apiKey: string): DecodedJwt | null {
	try {
		return jwtDecode<DecodedJwt>(apiKey);
	} catch (error) {
		console.error("Failed to decode JWT:", error);
		return null;
	}
}

export async function initializeMcpConfiguration(apiKey: string) {
	try {
		const decoded = decodeJwt(apiKey);
		if (!decoded) {
			vscode.window.showErrorMessage("Failed to decode API key.");
			return;
		}

		const issuer = decoded.iss;
		if (!issuer) {
			vscode.window.showErrorMessage("API key is missing 'iss' field.");
			return;
		}

		let baseUrl = "https://ast-master-components.dev.cxast.net";
		try {
			const hostname = new URL(issuer).hostname;
			if (hostname.includes("iam.checkmarx")) {
				const astHostname = hostname.replace("iam", "ast");
				baseUrl = `https://${astHostname}`;
			}
		} catch (e) {
			console.warn("Invalid issuer URL format:", issuer);
		}

		const fullUrl = `${baseUrl}/api/security-mcp/mcp`;

		const config = vscode.workspace.getConfiguration();
		const isCursor = vscode.env.appName.toLowerCase().includes("cursor");

		const fullMcp: McpConfig = config.get<McpConfig>("mcp") || {};
		const existingServers = fullMcp.servers || {};

		existingServers["checkmarx"] = {
			url: fullUrl,
			headers: {
				"cx-origin": "VsCode",
				Authorization: apiKey,
			},
		};

		if (isCursor) {
			fullMcp.servers = existingServers;
			await config.update("mcp", fullMcp, vscode.ConfigurationTarget.Global);
		} else {
			await config.update(
				"mcp",
				{ servers: existingServers },
				vscode.ConfigurationTarget.Global
			);
		}

		vscode.window.showInformationMessage("MCP configuration saved successfully.");
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "An unexpected error occurred during MCP setup.";
		vscode.window.showErrorMessage(message);
	}
}
