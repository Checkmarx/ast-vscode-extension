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

// Extended interface for VS Code's inspect() return to include policyValue
// policyValue exists at runtime for enterprise policies but isn't in official VS Code types
interface ConfigInspection {
	key: string;
	policyValue?: unknown;
	defaultValue?: unknown;
	globalValue?: unknown;
	workspaceValue?: unknown;
	workspaceFolderValue?: unknown;
	defaultLanguageValue?: unknown;
	globalLanguageValue?: unknown;
	workspaceLanguageValue?: unknown;
	workspaceFolderLanguageValue?: unknown;
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

			// Check the 'mcp' setting
			const mcpInspection = config.inspect('mcp') as ConfigInspection;

			// Or check the specific 'chat.mcp.access' policy setting
			const mcpAccessInspection = config.inspect('chat.mcp.access') as ConfigInspection;

			// Detailed logging for debugging
			console.log('[MCP] ========== VS Code Settings Inspection ==========');

			// Log RAW inspection result
			console.log('[MCP] RAW inspect result for "mcp":', JSON.stringify(mcpInspection, null, 2));
			console.log('[MCP] RAW inspect result for "chat.mcp.access":', JSON.stringify(mcpAccessInspection, null, 2));

			console.log('[MCP] Inspecting "mcp" setting:');
			if (mcpInspection) {
				console.log('[MCP]   key:', mcpInspection.key || 'N/A');
				console.log('[MCP]   policyValue:', mcpInspection.policyValue !== undefined ? mcpInspection.policyValue : '❌ NOT SET');
				console.log('[MCP]   defaultValue:', mcpInspection.defaultValue !== undefined ? mcpInspection.defaultValue : '❌ NOT SET');
				console.log('[MCP]   globalValue:', mcpInspection.globalValue !== undefined ? mcpInspection.globalValue : '❌ NOT SET');
				console.log('[MCP]   workspaceValue:', mcpInspection.workspaceValue !== undefined ? mcpInspection.workspaceValue : '❌ NOT SET');
				console.log('[MCP]   workspaceFolderValue:', mcpInspection.workspaceFolderValue !== undefined ? mcpInspection.workspaceFolderValue : '❌ NOT SET');
				console.log('[MCP]   defaultLanguageValue:', mcpInspection.defaultLanguageValue !== undefined ? mcpInspection.defaultLanguageValue : '❌ NOT SET');
			} else {
				console.log('[MCP]   ❌ mcpInspection is null/undefined');
			}

			console.log('[MCP] Inspecting "chat.mcp.access":');
			if (mcpAccessInspection) {
				console.log('[MCP]   key:', mcpAccessInspection.key || 'N/A');
				console.log('[MCP]   policyValue:', mcpAccessInspection.policyValue !== undefined ? mcpAccessInspection.policyValue : '❌ NOT SET');
				console.log('[MCP]   defaultValue:', mcpAccessInspection.defaultValue !== undefined ? mcpAccessInspection.defaultValue : '❌ NOT SET');
				console.log('[MCP]   globalValue:', mcpAccessInspection.globalValue !== undefined ? mcpAccessInspection.globalValue : '❌ NOT SET');
				console.log('[MCP]   workspaceValue:', mcpAccessInspection.workspaceValue !== undefined ? mcpAccessInspection.workspaceValue : '❌ NOT SET');
				console.log('[MCP]   workspaceFolderValue:', mcpAccessInspection.workspaceFolderValue !== undefined ? mcpAccessInspection.workspaceFolderValue : '❌ NOT SET');
			} else {
				console.log('[MCP]   ❌ mcpAccessInspection is null/undefined');
			}

			console.log('[MCP] ===================================================');

			// Check for policy restrictions
			if (mcpInspection?.policyValue !== undefined ||
				mcpAccessInspection?.policyValue !== undefined) {

				// Log for debugging
				console.error('[MCP] ⚠️  POLICY RESTRICTION DETECTED!');
				console.error('[MCP] MCP Policy Value:', mcpInspection?.policyValue);
				console.error('[MCP] MCP Access Policy Value:', mcpAccessInspection?.policyValue);
				console.error('[MCP] Organization policy is preventing MCP configuration changes.');

				vscode.window.showWarningMessage(
					"MCP configuration is managed by your organization's policy."
				);
				return;
			} else {
				console.log('[MCP] ✅ No policyValue restrictions detected - proceeding with installation');
			}

			const fullMcp: McpConfig = config.get<McpConfig>("mcp") || {};
			const existingServers = fullMcp.servers || {};

			console.log('[MCP] Current MCP config:', JSON.stringify(fullMcp, null, 2));
			console.log('[MCP] Existing servers:', Object.keys(existingServers));

			// Create a new object to avoid proxy issues
			const updatedServers = { ...existingServers };
			updatedServers[checkmarxMcpServerName] = mcpServer;

			console.log('[MCP] Updated servers will include:', Object.keys(updatedServers));
			console.log('[MCP] New Checkmarx server config:', JSON.stringify(mcpServer, null, 2));

			console.log('[MCP] ========== Attempting to Write Settings ==========');
			console.log('[MCP] Target: Global settings (ConfigurationTarget.Global)');
			console.log('[MCP] Setting key: "mcp"');
			console.log('[MCP] Platform:', process.platform);
			console.log('[MCP] VS Code version:', vscode.version);

			try {
				console.log('[MCP] Calling config.update()...');
				await config.update(
					"mcp",
					{ servers: updatedServers },
					vscode.ConfigurationTarget.Global
				);
				console.log('[MCP] ✅ config.update() completed successfully!');
				console.log('[MCP] ========== Settings Write SUCCESS ==========');
			} catch (updateError) {
				console.error('[MCP] ========== Settings Write FAILED ==========');
				console.error('[MCP] ❌ Exception caught during config.update()');
				console.error('[MCP] Error object:', updateError);
				console.error('[MCP] Error type:', updateError instanceof Error ? updateError.name : typeof updateError);
				console.error('[MCP] Error message:', updateError instanceof Error ? updateError.message : String(updateError));
				console.error('[MCP] Error stack:', updateError instanceof Error ? updateError.stack : 'N/A');

				// Try to get more error details
				if (updateError && typeof updateError === 'object') {
					console.error('[MCP] Error properties:', Object.keys(updateError));
					console.error('[MCP] Full error JSON:', JSON.stringify(updateError, Object.getOwnPropertyNames(updateError), 2));
				}

				// Check if error is policy-related
				const errorMsg = updateError instanceof Error ? updateError.message : String(updateError);
				const errorStr = JSON.stringify(updateError);

				console.error('[MCP] Checking for policy keywords in error...');
				const isPolicyError =
					errorMsg.toLowerCase().includes('policy') ||
					errorMsg.toLowerCase().includes('read-only') ||
					errorMsg.toLowerCase().includes('configured in system') ||
					errorMsg.toLowerCase().includes('permission') ||
					errorStr.toLowerCase().includes('policy');

				if (isPolicyError) {
					console.error('[MCP] ⚠️  POLICY RESTRICTION DETECTED via write error!');
					console.error('[MCP] This confirms that organization policy is blocking MCP installation.');
					vscode.window.showErrorMessage(
						"Unable to install MCP: Settings are managed by your organization's policy. Contact your IT administrator."
					);
				} else {
					console.error('[MCP] Error does not appear to be policy-related.');
					vscode.window.showErrorMessage(`Failed to install MCP: ${errorMsg}`);
				}

				console.error('[MCP] ========================================');
				throw updateError;
			}
		}

		vscode.window.showInformationMessage("MCP configuration saved successfully.");
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "An unexpected error occurred during MCP setup.";
		vscode.window.showErrorMessage(message);
	}
}
