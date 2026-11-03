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
 * Get the MCP server name based on the extension type, matching the product name the remediation
 * prompts refer to ("... tool in Checkmarx One Assist MCP"). It also keeps Checkmarx One apart from
 * the cx-devassist plugin, which contributes its own "Checkmarx" server.
 */
export function getCheckmarxMcpServerName(): string {
	return constants.getMcpServerName();
}

/** A legacy entry is ours only when it points at the Checkmarx MCP endpoint. */
function isOwnLegacyEntry(entry: unknown): boolean {
	return !!entry && JSON.stringify(entry).includes(constants.checkmarxMcpUrlMarker);
}

/** The name of our pre-rename entry in this server map, or undefined. */
function findLegacyServerName(servers: Record<string, McpServer> = {}): string | undefined {
	return constants.getLegacyMcpServerNames().find(name => isOwnLegacyEntry(servers[name]));
}

/** A copy of the server map without this extension's entry, current or legacy. */
function withoutCheckmarxServers(servers: Record<string, McpServer> = {}): Record<string, McpServer> {
	const updated = { ...servers };
	const legacyName = findLegacyServerName(servers);
	delete updated[getCheckmarxMcpServerName()];
	if (legacyName) {
		delete updated[legacyName];
	}
	return updated;
}

function hasCheckmarxServer(servers: Record<string, McpServer> = {}): boolean {
	return !!servers[getCheckmarxMcpServerName()] || !!findLegacyServerName(servers);
}

/** The server map with our legacy entry moved to the current name (an existing current entry wins), or undefined when there is none. */
function renameLegacyServer(servers: Record<string, McpServer> = {}): Record<string, McpServer> | undefined {
	const legacyName = findLegacyServerName(servers);
	if (!legacyName) {
		return undefined;
	}
	const updated = withoutCheckmarxServers(servers);
	updated[getCheckmarxMcpServerName()] = servers[getCheckmarxMcpServerName()] ?? servers[legacyName];
	return updated;
}

/** Renames our legacy entry under 'servers' (VS Code) and 'mcpServers' (other editors, Claude) in a JSON config file. */
function migrateLegacyServerInJsonFile(filePath: string): void {
	try {
		if (!fs.existsSync(filePath)) {
			return;
		}
		const mcpConfig: McpConfig = JSON.parse(fs.readFileSync(filePath, "utf-8"));
		const servers = renameLegacyServer(mcpConfig.servers);
		const mcpServers = renameLegacyServer(mcpConfig.mcpServers);
		if (!servers && !mcpServers) {
			return;
		}
		if (servers) {
			mcpConfig.servers = servers;
		}
		if (mcpServers) {
			mcpConfig.mcpServers = mcpServers;
		}
		fs.writeFileSync(filePath, JSON.stringify(mcpConfig, null, 2), "utf-8");
		console.log(`Renamed legacy MCP server to "${getCheckmarxMcpServerName()}" in ${filePath}`);
	} catch (error) {
		console.warn(`Failed to rename legacy MCP server entry in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Codex (openai.chatgpt) reads MCP config from ~/.codex/config.toml, shared with Codex CLI
 * and the desktop app. When the user has enabled "Run Codex in WSL", that file lives inside
 * the WSL filesystem instead, which we cannot reliably resolve/write from the Windows host.
 */
function isCodexRunningInWsl(): boolean {
	return vscode.workspace.getConfiguration("chatgpt").get<boolean>("runCodexInWindowsSubsystemForLinux", false);
}

function getCodexConfigPath(): string {
	return path.join(os.homedir(), ".codex", "config.toml");
}

function getCodexMcpServerName(): string {
	return constants.getCodexMcpServerName();
}

/**
 * Matches a server's table header through to (but not including) the next top-level `[...]`
 * header or end of file. Nested tables like `[mcp_servers."name".oauth]` are included via the
 * negative lookahead `(?!mcp_servers\\."${escapedName}\\.")`, which stops at any header not
 * under this server's namespace.
 */
function getCodexBlockPattern(serverName: string, withLeadingNewline = false): RegExp {
	const escapedName = serverName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(
		`${withLeadingNewline ? "\\n?" : ""}\\[mcp_servers\\."${escapedName}"\\][\\s\\S]*?(?=\\n\\[(?!mcp_servers\\."${escapedName}"\\.)|$)`,
		"g"
	);
}

/** Removes this extension's current block and its legacy block (only when it points at the Checkmarx MCP endpoint). */
function removeCodexCheckmarxBlocks(content: string, withLeadingNewline = false): string {
	let updated = content.replace(getCodexBlockPattern(getCodexMcpServerName(), withLeadingNewline), "");
	for (const legacyName of constants.getLegacyMcpServerNames()) {
		updated = updated.replace(getCodexBlockPattern(legacyName, withLeadingNewline), block =>
			block.includes(constants.checkmarxMcpUrlMarker) ? "" : block
		);
	}
	return updated;
}

/** Renames our legacy `[mcp_servers."Checkmarx"]` block (and its sub-tables) in ~/.codex/config.toml. */
function migrateLegacyCodexServer(): void {
	if (isCodexRunningInWsl()) {
		return;
	}
	const configPath = getCodexConfigPath();
	try {
		if (!fs.existsSync(configPath)) {
			return;
		}
		const content = fs.readFileSync(configPath, "utf-8");
		const currentName = getCodexMcpServerName();
		const hasCurrent = getCodexBlockPattern(currentName).test(content);
		let changed = false;
		let updated = content;
		for (const legacyName of constants.getLegacyMcpServerNames()) {
			updated = updated.replace(getCodexBlockPattern(legacyName, hasCurrent), block => {
				if (!block.includes(constants.checkmarxMcpUrlMarker)) {
					return block;
				}
				changed = true;
				// An existing current block wins; otherwise the legacy block keeps its settings under the new name
				return hasCurrent ? "" : block.split(`[mcp_servers."${legacyName}"`).join(`[mcp_servers."${currentName}"`);
			});
		}
		if (changed) {
			fs.writeFileSync(configPath, `${updated.trimEnd()}\n`, "utf-8");
			console.log(`Renamed legacy MCP server to "${currentName}" in ${configPath}`);
		}
	} catch (error) {
		console.warn(`Failed to rename legacy MCP server entry in ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function buildCodexTokenTomlBlock(serverName: string, url: string, apiKey: string): string {
	return `[mcp_servers."${serverName}"]\n` +
		`url = "${url}"\n` +
		`http_headers = { "cx-origin" = "${getCxOrigin()}", "Authorization" = "${apiKey}" }\n` +
		`enabled = true\n`;
}

// Uses Dynamic Client Registration (DCR): no [oauth] block, so Codex registers its own client
// against the server's OAuth metadata and negotiates scopes with it directly, the same way
// Claude does. The alternative "predefined client" form (client_id = "cx-mcp-client") forces
// Codex to request that client's full registered scope set, which Keycloak has been rejecting
// with invalid_scope for scopes like service_account/iam-api/microprofile-jwt that Codex's own
// OAuth client enumerates but that aren't granted to cx-mcp-client for this grant type.
function buildCodexOAuthTomlBlock(serverName: string, url: string): string {
	return `[mcp_servers."${serverName}"]\n` +
		`url = "${url}"\n` +
		`auth = "oauth"\n` +
		`enabled = true\n`;
}

/**
 * Replaces only the `[mcp_servers."<name>"]` block (and any nested `[mcp_servers."<name>".*]`
 * sub-tables) with a targeted text-block replace, leaving the rest of the user's config.toml
 * (model choice, approval policy, other MCP servers) untouched rather than parsing the full TOML.
 */
function writeCodexTomlBlock(newBlock: string): void {
	if (isCodexRunningInWsl()) {
		console.warn("Codex is configured to run inside WSL; skipping ~/.codex/config.toml write. Add the Checkmarx MCP server manually inside WSL.");
		vscode.window.showWarningMessage(
			"Codex is set to run inside WSL, so its config.toml could not be updated automatically. Please add the Checkmarx MCP server manually inside your WSL environment."
		);
		return;
	}

	const configPath = getCodexConfigPath();

	let content = "";
	if (fs.existsSync(configPath)) {
		try {
			content = fs.readFileSync(configPath, "utf-8");
		} catch (e) {
			console.warn("Failed to read existing codex config.toml:", e);
		}
	}

	let updated = removeCodexCheckmarxBlocks(content).trimEnd();
	updated = updated.length > 0 ? `${updated}\n\n${newBlock}` : newBlock;

	try {
		const dir = path.dirname(configPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(configPath, `${updated.trimEnd()}\n`, "utf-8");
	} catch (e) {
		throw new Error(`Failed to write codex config.toml: ${e}`);
	}
}

function writeToCodexConfig(mcpServer: McpServer): void {
	const url = mcpServer.url ?? mcpServer.serverUrl;
	if (!url) return;
	const block = buildCodexTokenTomlBlock(getCodexMcpServerName(), url, mcpServer.headers.Authorization);
	writeCodexTomlBlock(block);
}

function writeToCodexConfigOAuth(oauthUrl: string): void {
	const block = buildCodexOAuthTomlBlock(getCodexMcpServerName(), oauthUrl);
	writeCodexTomlBlock(block);
}

function removeFromCodexConfig(): void {
	if (isCodexRunningInWsl()) return;
	const configPath = getCodexConfigPath();
	if (!fs.existsSync(configPath)) return;

	try {
		const content = fs.readFileSync(configPath, "utf-8");
		const updated = removeCodexCheckmarxBlocks(content, true).trimEnd();
		fs.writeFileSync(configPath, updated.length > 0 ? `${updated}\n` : "", "utf-8");
	} catch (e) {
		const msg = `Failed to remove Codex MCP config: ${e}`;
		console.warn(msg);
		throw new Error(msg);
	}
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

	// Windsurf, Windsurf-Next, Devin, Devin-Next, Kiro use 'mcpServers' key
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

	// Claude uses 'mcpServers' and includes 'type'
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

/**
 * Moves Checkmarx One's pre-rename "Checkmarx" entry to "Checkmarx One Assist" in every place this
 * extension writes MCP config, keeping its value, so existing installs match the remediation prompts
 * and stop clashing with the cx-devassist plugin's server without reinstalling MCP. Only entries that
 * point at the Checkmarx MCP endpoint are moved. Every step is independent and never throws.
 */
export async function migrateLegacyMcpServerNames(): Promise<void> {
	if (constants.getLegacyMcpServerNames().length === 0) {
		return;
	}
	if (isIDE(constants.vsCodeAgentOrginalName)) {
		try {
			const config = vscode.workspace.getConfiguration();
			// User-level value only: get() merges in workspace servers, which must not be copied into user settings
			const globalMcp = config.inspect<McpConfig>("mcp")?.globalValue;
			const migrated = renameLegacyServer(globalMcp?.servers);
			if (migrated) {
				// Keep the other keys of the user's 'mcp' setting (e.g. inputs)
				await config.update("mcp", { ...globalMcp, servers: migrated }, vscode.ConfigurationTarget.Global);
				console.log(`Renamed legacy MCP server to "${getCheckmarxMcpServerName()}" in VS Code settings`);
			}
		} catch (error) {
			console.warn(`Failed to rename legacy MCP server entry in VS Code settings: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	let jsonFiles: Set<string>;
	try {
		// The editor's own file (Cursor, Windsurf, Devin, Kiro, or VS Code's mcp.json fallback) and Claude's files
		jsonFiles = new Set([
			getMcpConfigPath(),
			path.join(os.homedir(), ".claude", "settings.json"),
			path.join(os.homedir(), ".claude.json"),
		]);
	} catch (error) {
		console.warn(`Failed to resolve MCP config paths: ${error instanceof Error ? error.message : String(error)}`);
		return;
	}
	for (const filePath of jsonFiles) {
		migrateLegacyServerInJsonFile(filePath);
	}
	migrateLegacyCodexServer();
}

export function registerMcpSettingsInjector(context: vscode.ExtensionContext) {
	void migrateLegacyMcpServerNames();
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
		// Clear old entry (and the pre-rename name) to avoid merging with old OAuth config
		mcpConfig.servers = withoutCheckmarxServers(mcpConfig.servers);
		mcpConfig.servers[getCheckmarxMcpServerName()] = mcpServer as McpServer;
	}
	else {
		// Clear old entry (and the pre-rename name) to avoid merging with old OAuth config
		mcpConfig.mcpServers = withoutCheckmarxServers(mcpConfig.mcpServers);
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
			// Clear old entry (and the pre-rename name) to prevent mixing old OAuth config with new APIKey config
			claudeJson.mcpServers = withoutCheckmarxServers(claudeJson.mcpServers);
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
	if (mcpConfig.mcpServers && hasCheckmarxServer(mcpConfig.mcpServers)) {
		mcpConfig.mcpServers = withoutCheckmarxServers(mcpConfig.mcpServers);
		fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), "utf-8");
	}
	// Remove from servers (for VSCode fallback)
	else if (mcpConfig.servers && hasCheckmarxServer(mcpConfig.servers)) {
		mcpConfig.servers = withoutCheckmarxServers(mcpConfig.servers);
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
			if (hasCheckmarxServer(existingServers)) {
				// Create a new object without the Checkmarx server to avoid proxy issues
				const updatedServers = withoutCheckmarxServers(existingServers);
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
		removeFromCodexConfig();

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
			if (hostname.includes("iam-dev")) {
				// Dev/staging IAM (Checkmarx internal): keep the dev MCP backend default above.
				// The iam.checkmarx.* rewrite and the single-tenant fallback below would otherwise
				// produce a non-existent dev host for these issuers.
				baseUrl = baseUrl;
			} else if (hostname.includes("iam.checkmarx")) {
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
							...withoutCheckmarxServers(existingMcp.servers),
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
				} else if (target === 'codex-settings') {
					writeToCodexConfigOAuth(fullUrl);
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
					const updatedServers = withoutCheckmarxServers(fullMcp.servers);
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
				} else if (target === 'codex-settings') {
					writeToCodexConfig(mcpServer);
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
			// Clear old entry (and the pre-rename name) to avoid merging with old OAuth config
			c.mcpServers = withoutCheckmarxServers(c.mcpServers);
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
		// Clear old entry (and the pre-rename name) to avoid merging with old APIKey config
		mcpConfig.servers = withoutCheckmarxServers(mcpConfig.servers);
		mcpConfig.servers[getCheckmarxMcpServerName()] = oauthTemplate.servers?.[getCheckmarxMcpServerName()] as any;
	}
	// For other IDEs: update 'mcpServers' key
	else {
		// Clear old entry (and the pre-rename name) to avoid merging with old APIKey config
		mcpConfig.mcpServers = withoutCheckmarxServers(mcpConfig.mcpServers);
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
			// Clear old entry (and the pre-rename name) to avoid merging with old APIKey config
			c.mcpServers = withoutCheckmarxServers(c.mcpServers);
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
	const removeOne = (filePath: string) => {
		if (!fs.existsSync(filePath)) return;
		try {
			const c: McpConfig = JSON.parse(fs.readFileSync(filePath, "utf-8"));
			if (hasCheckmarxServer(c.mcpServers)) {
				c.mcpServers = withoutCheckmarxServers(c.mcpServers);
				fs.writeFileSync(filePath, JSON.stringify(c, null, 2), "utf-8");
			}
		} catch (e) { console.warn("removeFromClaudeConfig:", filePath, e); }
	};
	removeOne(path.join(os.homedir(), ".claude", "settings.json"));
	removeOne(path.join(os.homedir(), ".claude.json"));
}
