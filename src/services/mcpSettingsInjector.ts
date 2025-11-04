/**
 * MCP Settings Injector - Model Context Protocol Configuration
 * 
 * This module handles MCP (Model Context Protocol) installation and configuration
 * with support for different VS Code versions:
 * 
 * - VS Code 1.99+: Uses native MCP support via workspace configuration
 * - VS Code 1.88-1.98: Uses manual installation with custom configuration files
 * - Earlier versions: Not supported
 * 
 * For older VS Code versions (1.88-1.98), the configuration is saved to:
 * ~/.vscode/settings.json and manual events are used to trigger MCP functionality.
 */

import * as vscode from "vscode";
import { jwtDecode } from "jwt-decode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { isIDE } from "../utils/utils";
import { constants } from "../utils/common/constants";
interface DecodedJwt {
	iss: string;
}

interface McpServer {
	serverUrl?: string;
	url?: string;
	headers: {
		[key: string]: string;
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

interface VSCodeSettings {
	mcp?: McpConfig;
	[key: string]: unknown;
}

const checkmarxMcpServerName = "Checkmarx";

/**
 * Gets VS Code version and checks if it supports native MCP
 * @returns Object with version info and MCP support status
 */
function getVSCodeVersionInfo(): { version: string; majorVersion: number; minorVersion: number; supportsNativeMCP: boolean } {
	const vscodeVersion = vscode.version;
	const versionParts = vscodeVersion.split('.');
	const majorVersion = parseInt(versionParts[0], 10);
	const minorVersion = parseInt(versionParts[1], 10);

	// MCP is natively supported in VS Code 1.99 and above
	const supportsNativeMCP = majorVersion > 1 || (majorVersion === 1 && minorVersion >= 99);

	return {
		version: vscodeVersion,
		majorVersion,
		minorVersion,
		supportsNativeMCP
	};
}

/**
 * Shows manual installation instructions for older VS Code versions (1.88-1.98)
 */
async function showManualMCPInstallationInstructions(mcpServer: McpServer) {
	const versionInfo = getVSCodeVersionInfo();
	const configPath = path.join(os.homedir(), '.vscode', 'settings.json');

	const mcpConfig = {
		servers: {
			[checkmarxMcpServerName]: mcpServer
		}
	};

	// Create the directory if it doesn't exist
	const configDir = path.dirname(configPath);
	if (!fs.existsSync(configDir)) {
		fs.mkdirSync(configDir, { recursive: true });
	}

	// Read existing settings or create new
	let existingSettings: VSCodeSettings = {};
	if (fs.existsSync(configPath)) {
		try {
			const fileContent = fs.readFileSync(configPath, 'utf-8');
			existingSettings = JSON.parse(fileContent) as VSCodeSettings;
		} catch (error) {
			console.warn('Failed to read existing settings.json:', error);
		}
	}

	// Merge MCP configuration with existing settings
	const updatedSettings = {
		...existingSettings,
		mcp: {
			...existingSettings.mcp,
			...mcpConfig
		},
		// Add metadata as a comment-like property
		checkmarxMcpMetadata: {
			note: "Manual MCP configuration for VS Code versions 1.88-1.98",
			vsCodeVersion: versionInfo.version,
			installDate: new Date().toISOString(),
			steps: [
				"1. Configuration saved to ~/.vscode/settings.json",
				"2. Restart VS Code to apply changes",
				"3. MCP features will be available through this extension"
			]
		}
	};

	// Write the updated settings file
	fs.writeFileSync(configPath, JSON.stringify(updatedSettings, null, 2), 'utf-8');

	// Show information message with instructions
	const message = `MCP configuration completed for VS Code ${versionInfo.version}!\n\n` +
		`Since your VS Code version doesn't support native MCP installation, ` +
		`the configuration has been saved manually to:\n${configPath}\n\n` +
		`Please restart VS Code to activate MCP features.`;

	const action = await vscode.window.showInformationMessage(
		message,
		'Open Config File',
		'Copy Config Path',
		'View Documentation'
	);

	if (action === 'Open Config File') {
		const configUri = vscode.Uri.file(configPath);
		await vscode.window.showTextDocument(configUri);
	} else if (action === 'Copy Config Path') {
		await vscode.env.clipboard.writeText(configPath);
		vscode.window.showInformationMessage('Config file path copied to clipboard!');
	} else if (action === 'View Documentation') {
		vscode.env.openExternal(vscode.Uri.parse('https://docs.checkmarx.com/mcp-installation'));
	}
}

/**
 * Loads manual MCP configuration for older VS Code versions
 */
function loadManualMCPConfiguration(): McpServer | null {
	try {
		const configPath = path.join(os.homedir(), '.vscode', 'settings.json');
		if (fs.existsSync(configPath)) {
			const configContent = fs.readFileSync(configPath, 'utf-8');
			const config = JSON.parse(configContent) as VSCodeSettings;
			return config.mcp?.servers?.[checkmarxMcpServerName] || null;
		}
	} catch (error) {
		console.warn('Failed to load manual MCP configuration:', error);
	}
	return null;
}

/**
 * Creates a manual event to trigger MCP functionality for older VS Code versions
 */
function createManualMCPEvent(context: vscode.ExtensionContext) {
	// Register a manual command to trigger MCP functionality
	const manualMCPCommand = vscode.commands.registerCommand("ast-results.triggerMCP", async () => {
		const config = loadManualMCPConfiguration();
		if (config) {
			vscode.window.showInformationMessage("MCP functionality triggered manually!");
			// Emit event or trigger MCP-related functionality here
			context.globalState.update('mcpManuallyTriggered', true);
		} else {
			vscode.window.showWarningMessage("No manual MCP configuration found. Please install MCP first.");
		}
	});

	context.subscriptions.push(manualMCPCommand);
}

/**
 * Checks if manual MCP configuration exists for older VS Code versions
 */
export function hasManualMCPConfiguration(): boolean {
	return loadManualMCPConfiguration() !== null;
}

/**
 * Gets the manual MCP configuration if available
 */
export function getManualMCPConfiguration(): McpServer | null {
	return loadManualMCPConfiguration();
}

/**
 * Gets VS Code version information for external use
 */
export function getVersionInfo() {
	return getVSCodeVersionInfo();
}

/**
 * Checks if the current VS Code version requires manual MCP installation
 */
export function requiresManualMCPInstallation(): boolean {
	const versionInfo = getVSCodeVersionInfo();
	return !versionInfo.supportsNativeMCP &&
		versionInfo.majorVersion === 1 &&
		versionInfo.minorVersion >= 88 &&
		versionInfo.minorVersion < 99;
}


export function registerMcpSettingsInjector(context: vscode.ExtensionContext) {
	// Register the main MCP installation command
	vscode.commands.registerCommand("ast-results.installMCP", async () => {
		const apikey = await context.secrets.get("authCredential");
		if (!apikey) {
			vscode.window.showErrorMessage("Failed in install Checkmarx MCP: Authentication required");
			return;
		}
		await initializeMcpConfiguration(apikey);
	});

	// Create manual MCP event for older VS Code versions
	createManualMCPEvent(context);

	// Check VS Code version and show appropriate message
	const versionInfo = getVSCodeVersionInfo();
	if (!versionInfo.supportsNativeMCP) {
		console.log(`VS Code ${versionInfo.version} detected. Manual MCP installation will be used.`);

		// Show version-specific guidance
		if (versionInfo.majorVersion === 1 && versionInfo.minorVersion >= 88 && versionInfo.minorVersion < 99) {
			vscode.window.showInformationMessage(
				`VS Code ${versionInfo.version} detected. MCP will use manual installation mode for versions 1.88-1.98.`,
				'Learn More'
			).then(selection => {
				if (selection === 'Learn More') {
					vscode.env.openExternal(vscode.Uri.parse('https://docs.checkmarx.com/mcp-version-support'));
				}
			});
		}
	}
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

		// Check VS Code version to determine installation method
		const versionInfo = getVSCodeVersionInfo();

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
			headers: {},
		};

		// Set headers using bracket notation to avoid linting issues
		mcpServer.headers["cx-origin"] = isIDE(constants.windsurfAgent) ? constants.windsurfAgent : isIDE(constants.cursorAgent) ? constants.cursorAgent : "VsCode";
		mcpServer.headers["Authorization"] = apiKey;

		if (!isIDE(constants.vsCodeAgentOrginalName)) {
			await updateMcpJsonFile(mcpServer);
		} else {
			// Handle VS Code installation based on version
			if (!versionInfo.supportsNativeMCP) {
				// For VS Code versions 1.88-1.98, use manual installation
				await showManualMCPInstallationInstructions(mcpServer);
				vscode.window.showInformationMessage(
					`MCP manually configured for VS Code ${versionInfo.version}. Manual installation completed successfully.`
				);
			} else {
				// For VS Code 1.99+, use native MCP configuration
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

				vscode.window.showInformationMessage("MCP configuration saved successfully using native VS Code support.");
			}
		}
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "An unexpected error occurred during MCP setup.";
		vscode.window.showErrorMessage(message);
	}
}
