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
	command?: string;
	args?: string[];
	disabled?: boolean;
	autoApprove?: string[];
	alwaysAllow?: string[],
	toolChoice?: "any" | "required"
}

interface McpConfig {
	servers?: Record<string, McpServer>;
	mcpServers?: Record<string, McpServer>;
	toolChoice?: string;
	allowMCPServers?: string[];
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
			vscode.window.showErrorMessage(`Failed to install ${productName} MCP: Your session has been expired. Please login again.`);
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
	if (isIDE(constants.windsurfNextAgent)) {
		return path.join(homeDir, ".codeium", "windsurf-next", "mcp_config.json");
	}
	if (isIDE(constants.windsurfAgent)) {
		return path.join(homeDir, ".codeium", "windsurf", "mcp_config.json");
	}
	if (isIDE(constants.kiroAgent)) {
		return path.join(homeDir, ".kiro", "settings", "mcp.json");
	}
	if (isIDE(constants.geminiAgent)) {
		return path.join(os.homedir(), ".gemini", "settings.json");
	}
	// Claude: primary path; updateMcpJsonFile also writes to ~/.claude.json for compatibility
	if (isIDE(constants.claudeAgent)) {
		return path.join(homeDir, ".claude", "settings.json");
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

async function updateMcpJsonFile(mcpServer: McpServer): Promise<void> {
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
		// Claude Code requires "type": "http" in JSON to connect to remote MCP (see code.claude.com/docs/mcp)
		const serverEntry = mcpConfigPath.includes(".claude")
			? { type: "http", url: mcpServer.url, headers: mcpServer.headers }
			: mcpServer;
		mcpConfig.mcpServers[getCheckmarxMcpServerName()] = serverEntry as McpServer;
	}

	try {
		const dir = path.dirname(mcpConfigPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf-8");

		// Claude: also write to ~/.claude.json so MCP works in setups that read that file
		if (mcpConfigPath.includes(".claude") && mcpConfigPath.endsWith("settings.json")) {
			const claudeJsonPath = path.join(os.homedir(), ".claude.json");
			let claudeJson: McpConfig = {};
			if (fs.existsSync(claudeJsonPath)) {
				try {
					claudeJson = JSON.parse(fs.readFileSync(claudeJsonPath, "utf-8"));
				} catch (e) {
					console.warn("Failed to read existing .claude.json:", e);
				}
			}
			if (!claudeJson.mcpServers) claudeJson.mcpServers = {};
			claudeJson.mcpServers[getCheckmarxMcpServerName()] = { type: "http", url: mcpServer.url, headers: mcpServer.headers } as McpServer;
			fs.writeFileSync(claudeJsonPath, JSON.stringify(claudeJson, null, 2), "utf-8");
		}
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
		removeFromClaudeConfig();
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

		const mcpServer: McpServer = {
			...((isIDE(constants.windsurfAgent) || isIDE(constants.windsurfNextAgent)) ? { serverUrl: fullUrl } : { url: fullUrl }),
			headers: {
				"cx-origin": isIDE(constants.kiroAgent) ? constants.kiroAgent :
					(isIDE(constants.windsurfNextAgent) || isIDE(constants.windsurfAgent)) ?
						constants.windsurfAgent : isIDE(constants.cursorAgent) ?
							constants.cursorAgent : isIDE(constants.geminiAgent) ?
								constants.geminiAgent : isIDE(constants.claudeAgent) ?
									constants.claudeAgent : "VsCode",
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

		// So Claude Code extension sees Checkmarx MCP when used inside Cursor/VS Code (it reads ~/.claude/* only).
		// Skip when current IDE is Claude to avoid writing to ~/.claude/* twice (updateMcpJsonFile already did).
		if (!isIDE(constants.claudeAgent)) {
			writeToClaudeConfig(mcpServer);
		}

		vscode.window.showInformationMessage("MCP configuration saved successfully.");
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "An unexpected error occurred during MCP setup.";
		vscode.window.showErrorMessage(message);
	}
}

function writeToClaudeConfig(mcpServer: McpServer): void {
	// Claude Code requires "type": "http" in JSON to connect to remote MCP (see code.claude.com/docs/mcp)
	const server = {
		type: "http",
		url: mcpServer.url,
		headers: { ...mcpServer.headers, "cx-origin": constants.claudeAgent },
	};
	const name = getCheckmarxMcpServerName();
	const writeOne = (filePath: string) => {
		try {
			let c: McpConfig = {};
			if (fs.existsSync(filePath)) {
				try { c = JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { }
			}
			if (!c.mcpServers) c.mcpServers = {};
			c.mcpServers[name] = server;
			const dir = path.dirname(filePath);
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(filePath, JSON.stringify(c, null, 2), "utf-8");
		} catch (e) { console.warn("writeToClaudeConfig:", filePath, e); }
	};
	writeOne(path.join(os.homedir(), ".claude", "settings.json"));
	writeOne(path.join(os.homedir(), ".claude.json"));
}

function removeFromClaudeConfig(): void {
	const name = getCheckmarxMcpServerName();
	const removeOne = (filePath: string) => {
		if (!fs.existsSync(filePath)) return;
		try {
			const c: McpConfig = JSON.parse(fs.readFileSync(filePath, "utf-8"));
			if (c.mcpServers?.[name]) {
				delete c.mcpServers[name];
				fs.writeFileSync(filePath, JSON.stringify(c, null, 2), "utf-8");
			}
		} catch (e) { console.warn("removeFromClaudeConfig:", filePath, e); }
	};
	removeOne(path.join(os.homedir(), ".claude", "settings.json"));
	removeOne(path.join(os.homedir(), ".claude.json"));
}
