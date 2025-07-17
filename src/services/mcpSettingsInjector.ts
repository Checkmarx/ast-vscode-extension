import * as vscode from "vscode";
import { jwtDecode } from "jwt-decode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
interface DecodedJwt {
	iss: string;
}

interface McpServer {
	url: string;
	headers: {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		"cx-origin": string;
		// eslint-disable-next-line @typescript-eslint/naming-convention
		"Authorization": string;
	};
}

interface McpConfig {
	servers?: Record<string, McpServer>;
	mcpServers?: Record<string, McpServer>;
}

const checkmarxMcpServerName = "Checkmarx";


export function registerMcpSettingsInjector(context: vscode.ExtensionContext) {
	vscode.commands.registerCommand("ast-results.installMCP", async () => {
		const apikey = await context.secrets.get("authCredential");
		if (!apikey) {
			vscode.window.showErrorMessage("Failed in install Checkmarx MCP: Checkmarx API key not found");
			return;
		}
		initializeMcpConfiguration(apikey);
	});
}



function decodeJwt(apiKey: string): DecodedJwt | null {
	try {
		return jwtDecode<DecodedJwt>(apiKey);
	} catch (error) {
		console.error("Failed to decode JWT:", error);
		return null;
	}
}

function getMcpConfigPath(): string {
	const homeDir = os.homedir();
	return path.join(homeDir, ".cursor", "mcp.json");
}

async function updateMcpJsonFile(mcpServer: McpServer): Promise<void> {
	const mcpConfigPath = getMcpConfigPath();

	let mcpConfig: McpConfig = {};

	if (fs.existsSync(mcpConfigPath)) {
		try {
			const fileContent = fs.readFileSync(mcpConfigPath, "utf-8");
			mcpConfig = JSON.parse(fileContent);
		} catch (error) {
			console.warn("Failed to read existing mcp.json:", error);
		}
	}

	if (!mcpConfig.mcpServers) {
		mcpConfig.mcpServers = {};
	}

	mcpConfig.mcpServers[checkmarxMcpServerName] = mcpServer;

	try {
		const dir = path.dirname(mcpConfigPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf-8");
	} catch (error) {
		throw new Error(`Failed to write mcp.json: ${error}`);
	}
}

export async function uninstallMcp() {
	try {
		const isCursor = vscode.env.appName.toLowerCase().includes("cursor");

		if (isCursor) {
			// Handle Cursor: Remove from .cursor/mcp.json file
			const mcpConfigPath = getMcpConfigPath();

			if (!fs.existsSync(mcpConfigPath)) {
				vscode.window.showWarningMessage("MCP configuration file not found.");
				return;
			}

			const fileContent = fs.readFileSync(mcpConfigPath, "utf-8");
			const mcpConfig: McpConfig = JSON.parse(fileContent);

			if (mcpConfig.mcpServers && mcpConfig.mcpServers[checkmarxMcpServerName]) {
				delete mcpConfig.mcpServers[checkmarxMcpServerName];

				fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf-8");

				vscode.window.showInformationMessage("Checkmarx MCP configuration removed successfully.");
			} else {
				vscode.window.showWarningMessage("Checkmarx MCP configuration not found.");
			}
		} else {
			// Handle VSCode: Remove from settings
			const config = vscode.workspace.getConfiguration();
			const fullMcp: McpConfig = config.get<McpConfig>("mcp") || {};
			const existingServers = fullMcp.servers || {};
			if (existingServers[checkmarxMcpServerName]) {
				// Create a new object without the Checkmarx server to avoid proxy issues
				const updatedServers = { ...existingServers };
				delete updatedServers[checkmarxMcpServerName];
				await config.update(
					"mcp",
					{ servers: updatedServers },
					vscode.ConfigurationTarget.Global
				);
				vscode.window.showInformationMessage("Checkmarx MCP configuration removed successfully.");
			} else {
				vscode.window.showWarningMessage("Checkmarx MCP configuration not found.");
			}
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to remove MCP configuration.";
		vscode.window.showErrorMessage(message);
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

		const isCursor = vscode.env.appName.toLowerCase().includes("cursor");

		const mcpServer: McpServer = {
			url: fullUrl,
			headers: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				"cx-origin": "VsCode",
				// eslint-disable-next-line @typescript-eslint/naming-convention
				"Authorization": apiKey,
			},
		};

		if (isCursor) {
			await updateMcpJsonFile(mcpServer);
		} else {
			const config = vscode.workspace.getConfiguration();
			const fullMcp: McpConfig = config.get<McpConfig>("mcp") || {};
			const existingServers = fullMcp.servers || {};

			// Create a new object to avoid proxy issues
			const updatedServers = { ...existingServers };
			updatedServers[checkmarxMcpServerName] = mcpServer;

			await config.update(
				"mcp",
				{ servers: updatedServers },
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
