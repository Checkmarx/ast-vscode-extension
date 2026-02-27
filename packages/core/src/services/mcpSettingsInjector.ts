import * as vscode from "vscode";
import { jwtDecode } from "jwt-decode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { isIDE } from "../utils/utils";
import { constants } from "../utils/common/constants";
import { commands } from "../utils/common/commandBuilder";
import { cx } from "../cx";
import { getExtensionType, EXTENSION_TYPE } from "../config/extensionConfig";
import { getMessages } from "../config/extensionMessages";

interface DecodedJwt {
	iss: string;
}

interface McpServer {
	serverUrl?: string;
	url?: string;
	headers: {
		"cx-origin": string;
		"Authorization": string;
	};
}

interface KiroMcpServer {
	command: string,
	args: string[],
	disabled: boolean,
	autoApprove: string[]
}

interface McpConfig {
	servers?: Record<string, McpServer>;
	mcpServers?: Record<string, McpServer | KiroMcpServer>;
}

/**
 * Get the MCP server name based on the extension type
 * This allows both extensions to have separate MCP configurations
 */
function getCheckmarxMcpServerName(): string {
	const extensionType = getExtensionType();
	if (extensionType === EXTENSION_TYPE.DEVELOPER_ASSIST) {
		return "Checkmarx Developer Assist";
	}
	return "Checkmarx";
}


export function registerMcpSettingsInjector(context: vscode.ExtensionContext) {
	vscode.commands.registerCommand(commands.installMCP, async () => {
		const apikey = await context.secrets.get(constants.getAuthCredentialSecretKey());
		const productName = getMessages().productName;
		if (!apikey) {
			vscode.window.showErrorMessage(`Failed to install ${productName} MCP: Authentication required`);
			return;
		}
		else if (!await cx.isValidConfiguration()) {
			vscode.window.showErrorMessage(`Failed to install ${productName} MCP: Your login has expired. Please login again.`);
			return;
		}
		else if (!await cx.isAiMcpServerEnabled()) {
			vscode.window.showErrorMessage(`Failed to install ${productName} MCP: This feature has not been enabled for your tenant account.`);
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
	const homeDir = os.homedir();

	if (isIDE(constants.cursorAgent)) {
		return path.join(homeDir, ".cursor", "mcp.json");
	}
	if (isIDE(constants.windsurfAgent)) {
		return path.join(homeDir, ".codeium", "windsurf", "mcp_config.json");
	}
	if (isIDE(constants.kiroAgent)) {
		return path.join(homeDir, ".kiro", "settings", "mcp.json");
	}
	// VSCode - platform specific paths
	if (isIDE(constants.vsCodeAgentOrginalName)) {
		const platform = process.platform;
		if (platform === 'win32') {
			// Windows: %APPDATA%\Code\User\mcp.json
			const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
			return path.join(appData, 'Code', 'User', 'mcp.json');
		} else if (platform === 'darwin') {
			// macOS: ~/Library/Application Support/Code/User/mcp.json
			return path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
		} else {
			// Linux: ~/.config/Code/User/mcp.json
			return path.join(homeDir, '.config', 'Code', 'User', 'mcp.json');
		}
	}
	return path.join(homeDir, '.vscode', 'mcp.json');
}

async function updateMcpJsonFile(mcpServer: McpServer | KiroMcpServer): Promise<void> {
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

	if (isIDE(constants.vsCodeAgentOrginalName)) {
		if (!mcpConfig.servers) {
			mcpConfig.servers = {};
		}
		mcpConfig.servers[getCheckmarxMcpServerName()] = mcpServer as McpServer;
	}
	else {
		if (!mcpConfig.mcpServers) {
			mcpConfig.mcpServers = {};
		}
		mcpConfig.mcpServers[getCheckmarxMcpServerName()] = mcpServer;
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

async function removeMcpFromJsonFile(): Promise<void> {
	const mcpConfigPath = getMcpConfigPath();

	if (!fs.existsSync(mcpConfigPath)) {
		return;
	}

	const fileContent = fs.readFileSync(mcpConfigPath, "utf-8");
	const mcpConfig: McpConfig = JSON.parse(fileContent);

	// Remove from mcpServers (for Cursor, Windsurf, Kiro)
	if (mcpConfig.mcpServers && mcpConfig.mcpServers[getCheckmarxMcpServerName()]) {
		delete mcpConfig.mcpServers[getCheckmarxMcpServerName()];
		fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf-8");
	}
	// Remove from servers (for VSCode fallback)
	else if (mcpConfig.servers && mcpConfig.servers[getCheckmarxMcpServerName()]) {
		delete mcpConfig.servers[getCheckmarxMcpServerName()];
		fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf-8");
	}
}

export async function uninstallMcp() {
	try {
		if (!isIDE(constants.vsCodeAgentOrginalName)) {
			// Handle Cursor, Windsurf and Kiro: Remove from mcp json file
			await removeMcpFromJsonFile();
		} else {
			// Handle VSCode: Remove from settings
			const config = vscode.workspace.getConfiguration();
			const fullMcp: McpConfig = config.get<McpConfig>("mcp") || {};
			const existingServers = fullMcp.servers || {};
			if (existingServers[getCheckmarxMcpServerName()]) {
				// Create a new object without the Checkmarx server to avoid proxy issues
				const updatedServers = { ...existingServers };
				delete updatedServers[getCheckmarxMcpServerName()];
				try {
					await config.update(
						"mcp",
						{ servers: updatedServers },
						vscode.ConfigurationTarget.Global
					);
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					console.warn(`Failed to update MCP server details. Using fallback mechanism to configure mcp server details. Error: ${errorMessage}`);
					await removeMcpFromJsonFile();
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
			const config = vscode.workspace.getConfiguration();
			const fullMcp: McpConfig = config.get<McpConfig>("mcp") || {};
			const existingServers = fullMcp.servers || {};

			// Create a new object to avoid proxy issues
			const updatedServers = { ...existingServers };
			updatedServers[getCheckmarxMcpServerName()] = mcpServer;

			try {
				await config.update(
					"mcp",
					{ servers: updatedServers },
					vscode.ConfigurationTarget.Global
				);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.warn(`Failed to update MCP server details. Using fallback mechanism to configure mcp server details. Error: ${errorMessage}`);
				await updateMcpJsonFile(mcpServer);
			}
		}

		vscode.window.showInformationMessage("MCP configuration saved successfully.");
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "An unexpected error occurred during MCP setup.";
		vscode.window.showErrorMessage(message);
	}
}
