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
import { resolveMcpTargets } from "../utils/aiAssistantUtil";

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
 * Extract tenant name directly from JWT token
 * This is the source of truth - extracted from the issuer URL in the token
 */
function extractTenantFromToken(token: string): string | undefined {
	try {
		const parts = token.split('.');
		if (parts.length < 2) return undefined;
		const payload = parts[1]
			.replace(/-/g, '+')
			.replace(/_/g, '/');
		const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as { iss?: string };
		const iss = json?.iss;
		if (!iss) return undefined;
		const url = new URL(iss);
		const marker = '/auth/realms/';
		const idx = url.pathname.indexOf(marker);
		if (idx === -1) return undefined;
		const rest = url.pathname.slice(idx + marker.length);
		const tenant = rest.split('/')[0];
		return tenant || undefined;
	} catch {
		return undefined;
	}
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

function getCxOrigin(): string {
	if (isIDE(constants.kiroAgent)) {
		return constants.kiroAgent;
	}
	if (isIDE(constants.devinNextAgent) || isIDE(constants.devinAgent)) {
		return constants.devinAgent;
	}
	if (isIDE(constants.windsurfNextAgent) || isIDE(constants.windsurfAgent)) {
		return constants.windsurfAgent;
	}
	if (isIDE(constants.cursorAgent)) {
		return constants.cursorAgent;
	}
	if (isIDE(constants.claudeAgent)) {
		return constants.claudeAgent;
	}
	return "VsCode";
}

function getOAuthMcpTemplateForIde(url: string): { servers?: Record<string, any>; mcpServers?: Record<string, any> } {
	// VS Code uses 'servers' key with dynamic server name
	if (isIDE(constants.vsCodeAgentOrginalName)) {
		return {
			servers: {
				[getCheckmarxMcpServerName()]: {
					type: "http",
					url: url,
					oauth: {
						clientId: "cx-mcp-client"
					}
				}
			}
		};
	}

	// Cursor uses 'mcpServers' with predefined OAuth client (no DCR support)
	if (isIDE(constants.cursorAgent)) {
		return {
			mcpServers: {
				[getCheckmarxMcpServerName()]: {
					url: url,
					auth: {
						CLIENT_ID: "cx-mcp-client"
					}
				}
			}
		};
	}

	// Windsurf, Windsurf-Next, Devin, Devin-Next, Kiro use 'mcpServers' key with 'Checkmarx' name
	if (isIDE(constants.windsurfAgent) ||
		isIDE(constants.windsurfNextAgent) ||
		isIDE(constants.devinAgent) ||
		isIDE(constants.devinNextAgent) ||
		isIDE(constants.kiroAgent)) {
		return {
			mcpServers: {
				[getCheckmarxMcpServerName()]: {
					url: url
				}
			}
		};
	}

	// Claude uses 'mcpServers' with 'Checkmarx' name and includes 'type'
	if (isIDE(constants.claudeAgent)) {
		return {
			mcpServers: {
				[getCheckmarxMcpServerName()]: {
					type: "http",
					url: url
				}
			}
		};
	}

	// Default fallback
	return {
		mcpServers: {
			[getCheckmarxMcpServerName()]: {
				url: url
			}
		}
	};
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
			await uninstallMcp(context, false);
			return;
		}
		else {
			initializeMcpConfiguration(apikey, context);
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
	if (isIDE(constants.devinNextAgent)) {
		return path.join(homeDir, ".codeium", "windsurf-next", "mcp_config.json");
	}
	if (isIDE(constants.devinAgent)) {
		return path.join(homeDir, ".codeium", "windsurf", "mcp_config.json");
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
		// Clear old entry to avoid merging with old OAuth config
		delete mcpConfig.servers[getCheckmarxMcpServerName()];
		mcpConfig.servers[getCheckmarxMcpServerName()] = mcpServer as McpServer;
	}
	else {
		if (!mcpConfig.mcpServers) {
			mcpConfig.mcpServers = {};
		}
		// Clear old entry to avoid merging with old OAuth config
		delete mcpConfig.mcpServers[getCheckmarxMcpServerName()];
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
			// Clear old entry to prevent mixing old OAuth config with new APIKey config
			delete claudeJson.mcpServers[getCheckmarxMcpServerName()];
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

export async function uninstallMcp(context?: vscode.ExtensionContext, preserveMcpOnLogout?: boolean) {
	try {
		// If preserving MCP on logout, check the flag to see if MCP was configured via OAuth
		if (preserveMcpOnLogout === true && context) {
			const mcpSource = context.globalState.get<string>(constants.getMcpConfigSourceKey());
			if (mcpSource === "mcpOAuth") {
				console.log("MCP configured via OAuth - keeping configuration on logout");
				return; // Keep MCP, don't remove
			}
		}

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

		// Clear the flag after successfully removing MCP
		await context?.globalState.update(constants.getMcpConfigSourceKey(), null);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to remove MCP configuration.";
		vscode.window.showErrorMessage(message);
	}
}

export async function initializeMcpConfiguration(apiKey: string, context?: vscode.ExtensionContext) {
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
				// Multi-tenant: iam.checkmarx.* → ast.checkmarx.*
				baseUrl = `https://${hostname.replace("iam", "ast")}`;
			} else {
				// Single-tenant issuer hostname is the API base
				baseUrl = `https://${hostname}`;
			}
		} catch (e) {
			console.warn("Invalid issuer URL format:", issuer);
		}

		// GET AUTHENTICATION MODE SETTING
		const configSection = vscode.workspace.getConfiguration(constants.getAiAssistantConfigSection());
		let authMode = configSection.get<string>('MCP Authentication');
		console.log(`MCP authentication mode: ${authMode}`);

		const extensionType = getExtensionType();
		const defaultAuthMode = extensionType === EXTENSION_TYPE.DEVELOPER_ASSIST ? 'Token Based' : 'OAuth';

		// VALIDATE AND NORMALIZE authMode
		// For Checkmarx: valid values are ["OAuth", "Token Based"]
		// For Project-Ignite: valid values are ["Token Based"]
		const validAuthModes = extensionType === EXTENSION_TYPE.DEVELOPER_ASSIST
			? ['Token Based']
			: ['OAuth', 'Token Based'];

		if (!validAuthModes.includes(authMode)) {
			console.log(`Invalid MCP Authentication value: ${authMode}. Resetting to default: ${defaultAuthMode}`);
			authMode = defaultAuthMode;
			try {
				await configSection.update('MCP Authentication', defaultAuthMode, vscode.ConfigurationTarget.Global);
			} catch (error) {
				console.warn('Failed to update MCP Authentication:', error);
			}
		}

		// HANDLE OAUTH MODE (new behavior)
		if (authMode === 'OAuth') {
			// Extract tenant directly from the token - this is the source of truth
			const tenantName = extractTenantFromToken(apiKey);
			if (!tenantName) {
				vscode.window.showErrorMessage("Failed to extract tenant from authentication token.");
				return;
			}

			const fullUrl = `${baseUrl}/api/security-mcp/mcp/${tenantName}`;
			console.log(`OAuth mode - MCP URL: ${fullUrl}`);
			const oauthTemplate = getOAuthMcpTemplateForIde(fullUrl);
			const targets = resolveMcpTargets();

			if (targets.length === 0) {
				await uninstallMcp(context, false);
				return;
			}

			for (const target of targets) {
				if (target === 'vscode-settings') {
					const config = vscode.workspace.getConfiguration();
					const existingMcp: McpConfig = config.get<McpConfig>("mcp") || {};

					const updatedMcp = {
						servers: {
							...(existingMcp.servers || {}),
							[getCheckmarxMcpServerName()]: oauthTemplate.servers?.[getCheckmarxMcpServerName()]
						}
					};

					try {
						await config.update(
							"mcp",
							updatedMcp,
							vscode.ConfigurationTarget.Global
						);
						console.log("OAuth MCP configuration updated in VS Code settings");
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						console.warn(`Failed to update VS Code MCP settings: ${errorMessage}`);
						await updateMcpJsonFileOAuth(fullUrl);
					}
				} else if (target === 'ide-native-json') {
					await updateMcpJsonFileOAuth(fullUrl);
				} else if (target === 'claude-settings') {
					writeToClaudeConfigOAuth(fullUrl);
				}
			}
		}
		// HANDLE TOKEN BASED MODE
		else if (authMode === 'Token Based') {
			const fullUrl = `${baseUrl}/api/security-mcp/mcp`;
			console.log(`Token Based mode - MCP URL: ${fullUrl}`);
			const mcpServer: McpServer = {
				...((isIDE(constants.windsurfAgent) || isIDE(constants.windsurfNextAgent) || isIDE(constants.devinAgent) || isIDE(constants.devinNextAgent)) ? { serverUrl: fullUrl } : { url: fullUrl }),
				headers: {
					"cx-origin": getCxOrigin(),
					"Authorization": apiKey,
				},
			};

			const targets = resolveMcpTargets();
			if (targets.length === 0) {
				await uninstallMcp(context, false);
				return;
			}

			for (const target of targets) {
				if (target === 'vscode-settings') {
					const config = vscode.workspace.getConfiguration();
					const fullMcp: McpConfig = config.get<McpConfig>("mcp") || {};
					const updatedServers = { ...(fullMcp.servers || {}) };
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
				} else if (target === 'ide-native-json') {
					await updateMcpJsonFile(mcpServer);
				} else if (target === 'claude-settings') {
					writeToClaudeConfig(mcpServer);
				}
			}
		}

		vscode.window.showInformationMessage("MCP configuration saved successfully.");

		// Set flag to record how MCP was configured (OAuth or Token Based)
		const flagValue = (authMode === 'OAuth') ? "mcpOAuth" : "mcpTokenBased";
		await context?.globalState.update(
			constants.getMcpConfigSourceKey(),
			flagValue
		);
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
		url: mcpServer.url ?? mcpServer.serverUrl,
		headers: { ...mcpServer.headers },
	};
	const name = getCheckmarxMcpServerName();
	const writeOne = (filePath: string) => {
		try {
			let c: McpConfig = {};
			if (fs.existsSync(filePath)) {
				try { c = JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { }
			}
			if (!c.mcpServers) c.mcpServers = {};
			// Clear old entry to avoid merging with old OAuth config
			delete c.mcpServers[name];
			c.mcpServers[name] = server;
			const dir = path.dirname(filePath);
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(filePath, JSON.stringify(c, null, 2), "utf-8");
		} catch (e) { console.warn("writeToClaudeConfig:", filePath, e); }
	};
	writeOne(path.join(os.homedir(), ".claude", "settings.json"));
	writeOne(path.join(os.homedir(), ".claude.json"));
}

async function updateMcpJsonFileOAuth(oauthUrl: string): Promise<void> {
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

	// Get IDE-specific OAuth template
	const oauthTemplate = getOAuthMcpTemplateForIde(oauthUrl);

	// For VS Code: update 'servers' key
	if (isIDE(constants.vsCodeAgentOrginalName)) {
		if (!mcpConfig.servers) {
			mcpConfig.servers = {};
		}
		// Clear old entry to avoid merging with old APIKey config
		delete mcpConfig.servers[getCheckmarxMcpServerName()];
		mcpConfig.servers[getCheckmarxMcpServerName()] = oauthTemplate.servers?.[getCheckmarxMcpServerName()] as any;
	}
	// For other IDEs: update 'mcpServers' key
	else {
		if (!mcpConfig.mcpServers) {
			mcpConfig.mcpServers = {};
		}
		// Clear old entry to avoid merging with old APIKey config
		delete mcpConfig.mcpServers[getCheckmarxMcpServerName()];
		mcpConfig.mcpServers[getCheckmarxMcpServerName()] = oauthTemplate.mcpServers?.[getCheckmarxMcpServerName()] as any;
	}

	try {
		const dir = path.dirname(mcpConfigPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf-8");
		console.log(`OAuth MCP configuration written to ${mcpConfigPath}`);
	} catch (error) {
		throw new Error(`Failed to write mcp json file: ${error}`);
	}
}

function writeToClaudeConfigOAuth(oauthUrl: string): void {
	// Claude OAuth format: only include type and url, no headers
	const server = {
		type: "http",
		url: oauthUrl
	};

	const name = getCheckmarxMcpServerName();
	const writeOne = (filePath: string) => {
		try {
			let c: McpConfig = {};
			if (fs.existsSync(filePath)) {
				try { c = JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { }
			}
			if (!c.mcpServers) c.mcpServers = {};
			// Clear old entry to avoid merging with old APIKey config
			delete c.mcpServers[name];
			c.mcpServers[name] = server as any;
			const dir = path.dirname(filePath);
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(filePath, JSON.stringify(c, null, 2), "utf-8");
			console.log(`OAuth MCP configuration written to ${filePath}`);
		} catch (e) {
			console.warn("writeToClaudeConfigOAuth:", filePath, e);
		}
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
