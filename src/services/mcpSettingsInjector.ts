import * as vscode from "vscode";
import { jwtDecode } from "jwt-decode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { isIDE } from "../utils/utils";
import { constants } from "../utils/common/constants";
import { cx } from "../cx";
interface DecodedJwt {
	iss: string;
}

interface McpServer {
	serverUrl?: string;
	url?: string;
	headers?: {
		"cx-origin": string;
		"Authorization": string;
	};
	command?: string;
	args?: string[];
	disabled?: boolean;
	autoApprove?: string[];
}

interface KiroMcpServer {
	command: string,
	args: string[],
	disabled: boolean,
	autoApprove: string[]
}

interface McpConfig {
	servers?: Record<string, McpServer>;
	mcpServers?: Record<string, McpServer | KiroMcpServer | CommandBasedMcpServer>;
	toolChoice?: string;
	allowMCPServers?: string[];
}

interface CommandBasedMcpServer {
	command: string,
	args: string[],
	disabled: boolean,
	autoApprove: string[],
	alwaysAllow?: string[],
	toolChoice?: "any" | "required"

}

const checkmarxMcpServerName = "Checkmarx";


export function registerMcpSettingsInjector(context: vscode.ExtensionContext) {
	vscode.commands.registerCommand("ast-results.installMCP", async () => {
		const apikey = await context.secrets.get(constants.authCredentialSecretKey);
		if (!apikey) {
			vscode.window.showErrorMessage("Failed in install Checkmarx MCP: Authentication required");
			return;
		}
		else if (!await cx.isAiMcpServerEnabled()) {
			vscode.window.showErrorMessage("Failed to install Checkmarx MCP: This feature has not been enabled for your tenant account.");
			uninstallMcp();
			return;
		}
		else {
			initializeMcpConfiguration(apikey);
		}
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
	if (isIDE(constants.cursorAgent)) {
		const homeDir = os.homedir();
		return path.join(homeDir, ".cursor", "mcp.json");
	}
	if (isIDE(constants.windsurfAgent)) {
		return path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json");
	}
	if (isIDE(constants.kiroAgent)) {
		return path.join(os.homedir(), ".kiro", "settings", "mcp.json");
	}
	if (isIDE(constants.vsCodeAgentOrginalName)) {
		return path.join(os.homedir(), ".gemini", "settings.json");
	}
}

async function updateMcpJsonFile(mcpServer: McpServer | KiroMcpServer | CommandBasedMcpServer): Promise<void> {
	const mcpConfigPath = getMcpConfigPath();

	let mcpConfig: McpConfig = {};

	if (fs.existsSync(mcpConfigPath)) {
		try {
			const fileContent = fs.readFileSync(mcpConfigPath, "utf-8");
			mcpConfig = JSON.parse(fileContent);
		} catch (error) {
			console.warn("Failed to read existing mcp json:", error);
		}
	}

	if (!mcpConfig.mcpServers) {
		mcpConfig.mcpServers = {};
	}

	mcpConfig.mcpServers[checkmarxMcpServerName] = mcpServer;

	const geminiExtension = vscode.extensions.getExtension(constants.geminiChatExtensionId);
	if (geminiExtension) {
		mcpConfig.toolChoice = "any";
		mcpConfig.allowMCPServers = [checkmarxMcpServerName];
	}

	try {
		const dir = path.dirname(mcpConfigPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf-8");
	} catch (error) {
		throw new Error(`Failed to write mcp json file: ${error}`);
	}
}

export async function uninstallMcp() {
	try {

		if (!isIDE(constants.vsCodeAgentOrginalName)) {
			// Handle Cursor, Windsurf and Kiro: Remove from mcp json file 
			const mcpConfigPath = getMcpConfigPath();

			if (!fs.existsSync(mcpConfigPath)) {
				return;
			}

			const fileContent = fs.readFileSync(mcpConfigPath, "utf-8");
			const mcpConfig: McpConfig = JSON.parse(fileContent);

			if (mcpConfig.mcpServers && mcpConfig.mcpServers[checkmarxMcpServerName]) {
				delete mcpConfig.mcpServers[checkmarxMcpServerName];

				fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf-8");
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
			}
		}

		const geminiExtension = vscode.extensions.getExtension(constants.geminiChatExtensionId);
		if (geminiExtension) {
			const geminiConfigPath = path.join(os.homedir(), ".gemini", "settings.json");

			if (fs.existsSync(geminiConfigPath)) {
				try {
					const fileContent = fs.readFileSync(geminiConfigPath, "utf-8");
					const geminiConfig: McpConfig = JSON.parse(fileContent);

					if (geminiConfig.mcpServers && geminiConfig.mcpServers[checkmarxMcpServerName]) {
						delete geminiConfig.mcpServers[checkmarxMcpServerName];
					}

					if (geminiConfig.mcpServers && Object.keys(geminiConfig.mcpServers).length === 0) {
						delete geminiConfig.toolChoice;
						delete geminiConfig.allowMCPServers;
					} else if (geminiConfig.allowMCPServers) {
						geminiConfig.allowMCPServers = geminiConfig.allowMCPServers.filter(
							name => name !== checkmarxMcpServerName
						);
						if (geminiConfig.allowMCPServers.length === 0) {
							delete geminiConfig.allowMCPServers;
						}
					}

					fs.writeFileSync(geminiConfigPath, JSON.stringify(geminiConfig, null, 2), "utf-8");
				} catch (error) {
					console.warn("Failed to clean up Gemini config:", error);
				}
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

		if (isIDE(constants.kiroAgent)) {
			const kiroMcpServer: KiroMcpServer = {
				command: "npx",
				args: [
					"mcp-remote",
					fullUrl,
					"--transport",
					"sse",
					"--header",
					`Authorization:${apiKey}`,
					`cx-origin : ${constants.kiroAgent}`
				],
				disabled: false,
				autoApprove: ["codeRemediation", "imageRemediation", "packageRemediation"]
			};
			await updateMcpJsonFile(kiroMcpServer);
			return;
		}

		const mcpServer: McpServer = {
			...(isIDE(constants.windsurfAgent) ? { serverUrl: fullUrl } : { url: fullUrl }),
			headers: {
				"cx-origin": isIDE(constants.windsurfAgent) ? constants.windsurfAgent : isIDE(constants.cursorAgent) ? constants.cursorAgent : "VsCode",
				"Authorization": apiKey,
			},
		};

		if (!isIDE(constants.vsCodeAgentOrginalName)) {
			await updateMcpJsonFile(mcpServer);
		} else {
			const mcpServerCommandBased: CommandBasedMcpServer = {
				command: "npx",
				args: [
					"mcp-remote",
					fullUrl,
					"--transport",
					"sse",
					"--interactive",
					"--header",
					`Authorization:${apiKey}`,
					"--header",
					"cx-origin:VsCode"
				],
				disabled: false,
				autoApprove: [],
				toolChoice: "any"
			};
			const config = vscode.workspace.getConfiguration();
			const fullMcp: McpConfig = config.get<McpConfig>("mcp") || {};
			const existingServers = fullMcp.servers || {};

			// Create a new object to avoid proxy issues
			const updatedServers = { ...existingServers };

			updatedServers[checkmarxMcpServerName] = mcpServerCommandBased;

			await config.update(
				"mcp",
				{ servers: updatedServers },
				vscode.ConfigurationTarget.Global
			);
			await updateMcpJsonFile(mcpServerCommandBased);
		}

		vscode.window.showInformationMessage("MCP configuration saved successfully.");
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "An unexpected error occurred during MCP setup.";
		vscode.window.showErrorMessage(message);
	}
}
