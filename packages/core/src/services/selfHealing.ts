import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import { constants } from "../utils/common/constants";
import { commands } from "../utils/common/commandBuilder";
import { isCopilotInstalled } from "../utils/aiAssistantUtil";
import { Logs } from "../models/logs";
import { cx } from "../cx";
import {
	getIdeOnboardingConfigKeys,
	isSelfHealingEnabled,
	BOM_PATTERN,
	setIdeOnboardingAuthenticated,
	syncIdeOnboardingProperties,
} from "./ideOnboardingProperties";

/**
 * Checkmarx Self-Healing: keeps ~/.checkmarx/cx-onboarding-ide.properties in sync with the
 * settings and nudges the user to install GitHub Copilot / the cx-devassist Copilot plugin.
 * The plugin counts as installed when the Copilot CLI or VS Code (Agent Customizations > Plugins) installed it.
 */

export type SelfHealingPrompt = "installCopilot" | "installPlugin" | undefined;

export interface SelfHealingPromptState {
	selfHealingEnabled: boolean;
	copilotInstalled: boolean;
	pluginInstalled: boolean;
	dismissed: boolean;
	shownThisSession: boolean;
}

export const selfHealingMessages = {
	installCopilot: "Checkmarx Self-Healing works with GitHub Copilot. Install GitHub Copilot to automatically fix newly generated code.",
	installPlugin: "Install the Checkmarx Copilot plugin (cx-devassist) to enable Self-Healing in Copilot.",
	vsCodeOnly: "Checkmarx Self-Healing works with GitHub Copilot in Visual Studio Code only.",
	installCopilotButton: "Install Copilot",
	installPluginButton: "Install plugin",
	dontShowAgainButton: "Don't show again",
	pluginHelp: "Install the Checkmarx Copilot plugin (cx-devassist). \"Install in VS Code\" installs it with the GitHub Copilot CLI, for VS Code and the terminal Copilot CLI.",
	pluginAlreadyInstalled: "The Checkmarx Copilot plugin (cx-devassist) is already installed",
	installingPlugin: "Installing the Checkmarx Copilot plugin (cx-devassist)...",
	pluginInstalled: "The Checkmarx Copilot plugin (cx-devassist) is installed. Start a new Copilot chat to use it.",
	pluginInstallFailed: "Could not install the Checkmarx Copilot plugin (cx-devassist):",
	copilotCliNotFound: "The GitHub Copilot CLI (copilot) was not found, so the Checkmarx Copilot plugin cannot be installed automatically. Install cx-devassist from the VS Code plugin browser instead.",
	openPluginBrowserButton: "Open plugin browser",
	installInVsCodeButton: "Install in VS Code",
	copyCommandsButton: "Copy install commands",
	openGuideButton: "Open guide",
	commandsCopied: "Checkmarx Copilot plugin install commands copied to the clipboard. Run them in the GitHub Copilot CLI.",
	browsePluginsFallback: "To install the Checkmarx Copilot plugin (cx-devassist) in VS Code, open Chat > Agent Customizations > Plugins > Browse Marketplace.",
	marketplaceUpdateFailed: "Could not add the Checkmarx marketplace to the chat.plugins.marketplaces setting.",
};

let shownThisSession = false;
// Set by a login or by turning Self-Healing ON; the Copilot config watcher only re-evaluates after that
let promptArmed = false;
let currentLogs: Logs | undefined;

/** Pure gating logic for the install messages. */
export function decideSelfHealingPrompt(state: SelfHealingPromptState): SelfHealingPrompt {
	if (!state.selfHealingEnabled || state.dismissed || state.shownThisSession) {
		return undefined;
	}
	if (!state.copilotInstalled) {
		return "installCopilot";
	}
	if (!state.pluginInstalled) {
		return "installPlugin";
	}
	return undefined;
}

export function getCopilotConfigPath(homeDir: string = os.homedir()): string {
	return path.join(homeDir, ".copilot", "config.json");
}

/** Removes // and /* *\/ comments and trailing commas, leaving string literals untouched. */
export function stripJsonComments(text: string): string {
	let out = "";
	let inString = false;
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		const next = text[i + 1];
		if (inString) {
			out += ch;
			if (ch === "\\" && i + 1 < text.length) {
				out += next;
				i += 2;
				continue;
			}
			if (ch === "\"") {
				inString = false;
			}
			i++;
		} else if (ch === "\"") {
			inString = true;
			out += ch;
			i++;
		} else if (ch === "/" && next === "/") {
			while (i < text.length && text[i] !== "\n") {
				i++;
			}
		} else if (ch === "/" && next === "*") {
			i += 2;
			while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
				i++;
			}
			i += 2;
		} else {
			out += ch;
			i++;
		}
	}
	return removeTrailingCommas(out);
}

/** Removes commas directly followed (after whitespace) by } or ], outside string literals. */
function removeTrailingCommas(text: string): string {
	let out = "";
	let inString = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (inString) {
			out += ch;
			if (ch === "\\" && i + 1 < text.length) {
				out += text[++i];
			} else if (ch === "\"") {
				inString = false;
			}
			continue;
		}
		if (ch === "\"") {
			inString = true;
		} else if (ch === ",") {
			let j = i + 1;
			while (j < text.length && /\s/.test(text[j])) {
				j++;
			}
			if (text[j] === "}" || text[j] === "]") {
				continue;
			}
		}
		out += ch;
	}
	return out;
}

/** Where the Copilot CLI keeps cx-devassist: ~/.copilot/installed-plugins/cx-devassist-marketplace/cx-devassist. */
export function getCopilotCliPluginDir(homeDir: string = os.homedir()): string {
	return path.join(homeDir, ".copilot", "installed-plugins", constants.cxDevAssistPluginMarketplace, constants.cxDevAssistPluginName);
}

/** The folder of the enabled cx-devassist entry in ~/.copilot/config.json, or undefined when there is none. */
export function getCopilotCliInstallPath(homeDir?: string): string | undefined {
	try {
		const raw = fs.readFileSync(getCopilotConfigPath(homeDir), "utf8").replace(BOM_PATTERN, "");
		const config = JSON.parse(stripJsonComments(raw));
		const plugins = config?.installedPlugins;
		if (!Array.isArray(plugins)) {
			return undefined;
		}
		const entry = plugins.find(
			(p: { name?: unknown; marketplace?: unknown; enabled?: unknown }) =>
				p?.name === constants.cxDevAssistPluginName &&
				p?.marketplace === constants.cxDevAssistPluginMarketplace &&
				p?.enabled !== false
		);
		if (!entry) {
			return undefined;
		}
		return typeof entry.cache_path === "string" && entry.cache_path ? entry.cache_path : getCopilotCliPluginDir(homeDir);
	} catch {
		return undefined;
	}
}

/** True when ~/.copilot/config.json lists an enabled cx-devassist plugin from cx-devassist-marketplace. */
export function isCxDevAssistPluginInstalled(homeDir?: string): boolean {
	return getCopilotCliInstallPath(homeDir) !== undefined;
}

/** ~/.vscode/agent-plugins/installed.json: plugins installed by VS Code (default profile). */
export function getVsCodeInstalledPluginsPath(homeDir: string = os.homedir()): string {
	return path.join(homeDir, ".vscode", "agent-plugins", "installed.json");
}

/** <VS Code user-data>/agentPlugins/cache.json: plugins VS Code runs. */
export function getVsCodeAgentPluginsCachePath(userDataDir: string): string {
	return path.join(userDataDir, "agentPlugins", "cache.json");
}

/**
 * VS Code user-data dir from context.globalStorageUri, which is <user-data>/User/globalStorage/<ext-id>
 * or <user-data>/User/profiles/<id>/globalStorage/<ext-id>: the parent of the nearest "User" folder.
 */
export function getVsCodeUserDataDir(context?: Pick<vscode.ExtensionContext, "globalStorageUri">): string | undefined {
	try {
		const storagePath = context?.globalStorageUri?.fsPath;
		if (!storagePath) {
			return undefined;
		}
		let current = path.resolve(storagePath);
		for (;;) {
			const parent = path.dirname(current);
			if (parent === current) {
				return undefined;
			}
			if (path.basename(current).toLowerCase() === "user") {
				return parent;
			}
			current = parent;
		}
	} catch {
		return undefined;
	}
}

type LenientJson = { kind: "json"; value: unknown } | { kind: "text"; text: string };

/** Reads a (comment-tolerant) JSON file; undefined when missing or unreadable. */
function readJsonLenient(filePath: string): LenientJson | undefined {
	let text: string;
	try {
		text = fs.readFileSync(filePath, "utf8").replace(BOM_PATTERN, "");
	} catch {
		return undefined;
	}
	try {
		return { kind: "json", value: JSON.parse(stripJsonComments(text)) };
	} catch {
		return { kind: "text", text };
	}
}

function containsArray(value: unknown): boolean {
	if (Array.isArray(value)) {
		return true;
	}
	return !!value && typeof value === "object" && Object.values(value as object).some(containsArray);
}

/**
 * Candidates that may describe one plugin: every string (values and keys), every array element,
 * and every object property whose value holds no array (so a list of entries is never merged into one).
 */
function collectPluginCandidates(node: unknown, out: string[]): void {
	if (typeof node === "string") {
		out.push(node);
	} else if (Array.isArray(node)) {
		for (const item of node) {
			if (item && typeof item === "object" && !Array.isArray(item)) {
				out.push(JSON.stringify(item));
			}
			collectPluginCandidates(item, out);
		}
	} else if (node && typeof node === "object") {
		for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
			out.push(key);
			if (value && typeof value === "object" && !containsArray(value)) {
				out.push(JSON.stringify({ [key]: value }));
			}
			collectPluginCandidates(value, out);
		}
	}
}

function normalizeForMatch(text: string): string {
	let decoded = text;
	try {
		decoded = decodeURIComponent(text);
	} catch {
		// keep as is
	}
	return decoded.replace(/\\\\/g, "/").replace(/\\/g, "/").toLowerCase();
}

/** cx-devassist (or copilot-devassist) together with cx-agentic-ai, case-insensitive. */
export function refersToCxDevAssistFromAgenticAi(text: string): boolean {
	const t = normalizeForMatch(text);
	return t.includes("cx-agentic-ai") && (t.includes("cx-devassist") || t.includes("copilot-devassist"));
}

function refersToCxDevAssistRunCopy(text: string): boolean {
	return refersToCxDevAssistFromAgenticAi(text) || normalizeForMatch(text).includes("cx-devassist-marketplace/cx-devassist");
}

function collectStrings(node: unknown, out: string[]): void {
	if (typeof node === "string") {
		out.push(node);
	} else if (node && typeof node === "object") {
		for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
			if (!Array.isArray(node)) {
				out.push(key);
			}
			collectStrings(value, out);
		}
	}
}

/** String literals of a file that does not parse as JSON. */
function quotedStrings(text: string): string[] {
	const out: string[] = [];
	const pattern = /"((?:[^"\\]|\\.)*)"/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text)) !== null) {
		out.push(match[1]);
	}
	return out;
}

/**
 * installed.json files of VS Code's own plugin installs: VS Code keeps one per profile, in the profile's
 * agent-plugins home next to mcp.json — <user-data>/User/agent-plugins/installed.json (default profile)
 * and <user-data>/User/profiles/<id>/agent-plugins/installed.json.
 */
export function getVsCodeProfileInstalledPluginsPaths(userDataDir: string): string[] {
	const userDir = path.join(userDataDir, "User");
	const paths = [path.join(userDir, "agent-plugins", "installed.json")];
	try {
		for (const profile of fs.readdirSync(path.join(userDir, "profiles"))) {
			paths.push(path.join(userDir, "profiles", profile, "agent-plugins", "installed.json"));
		}
	} catch {
		// no named profiles
	}
	return paths;
}

/** The installed.json files (profile homes, or ~/.vscode/agent-plugins) that list cx-devassist from Checkmarx/cx-agentic-ai. */
export function getCxDevAssistVsCodeInstalledJsonFiles(homeDir?: string, userDataDir?: string): string[] {
	const files = [getVsCodeInstalledPluginsPath(homeDir), ...(userDataDir ? getVsCodeProfileInstalledPluginsPaths(userDataDir) : [])];
	return files.filter(isCxDevAssistInInstalledJsonFile);
}

/** (a) An installed.json (profile homes, or ~/.vscode/agent-plugins) refers to cx-devassist from Checkmarx/cx-agentic-ai. */
export function isCxDevAssistInVsCodeInstalledJson(homeDir?: string, userDataDir?: string): boolean {
	return getCxDevAssistVsCodeInstalledJsonFiles(homeDir, userDataDir).length > 0;
}

function isCxDevAssistInInstalledJsonFile(file: string): boolean {
	try {
		const json = readJsonLenient(file);
		if (!json) {
			return false;
		}
		if (json.kind === "text") {
			return refersToCxDevAssistFromAgenticAi(json.text);
		}
		const candidates: string[] = [];
		collectPluginCandidates(json.value, candidates);
		return candidates.some(refersToCxDevAssistFromAgenticAi);
	} catch {
		return false;
	}
}

/** The folder a file: uri (or a plain path) points to, when it still exists. */
function existingFolderOf(uriOrPath: string): string | undefined {
	try {
		const folder = /^file:/i.test(uriOrPath) ? fileURLToPath(uriOrPath) : uriOrPath;
		return path.isAbsolute(folder) && fs.statSync(folder).isDirectory() ? folder : undefined;
	} catch {
		return undefined;
	}
}

/**
 * (b) The cx-devassist folders <user-data>/agentPlugins/cache.json lists that still exist on disk. VS Code
 * keeps an entry after the plugin is removed, so an entry alone does not prove an install.
 */
export function getCxDevAssistVsCodeCacheFolders(userDataDir?: string): string[] {
	if (!userDataDir) {
		return [];
	}
	try {
		const json = readJsonLenient(getVsCodeAgentPluginsCachePath(userDataDir));
		if (!json) {
			return [];
		}
		const strings: string[] = [];
		if (json.kind === "json") {
			collectStrings(json.value, strings);
		} else {
			strings.push(...quotedStrings(json.text));
		}
		const folders = strings.filter(refersToCxDevAssistRunCopy).map(existingFolderOf);
		return [...new Set(folders.filter((f): f is string => !!f))];
	} catch {
		return [];
	}
}

/** (b) <user-data>/agentPlugins/cache.json lists a cx-devassist plugin folder that still exists. */
export function isCxDevAssistInVsCodeAgentPluginsCache(userDataDir?: string): boolean {
	return getCxDevAssistVsCodeCacheFolders(userDataDir).length > 0;
}

export interface PluginDetectionOptions {
	homeDir?: string;
	userDataDir?: string;
}

/** True when VS Code itself installed cx-devassist (installed.json or the agentPlugins cache). */
export function isCxDevAssistPluginInstalledInVsCode(options: PluginDetectionOptions = {}): boolean {
	return getCxDevAssistInstallLocations(options).some(location => location.source === "vscode");
}

export type CxDevAssistInstallSource = "copilotCli" | "vscode";

export interface CxDevAssistInstallLocation {
	source: CxDevAssistInstallSource;
	/** The plugin folder, or the installed.json that records a VS Code install. */
	path: string;
}

function isCopilotCliFolder(folder: string): boolean {
	return normalizeForMatch(folder).includes("/.copilot/installed-plugins/");
}

/**
 * Every place cx-devassist is installed: the Copilot CLI (~/.copilot/config.json), VS Code's own installs
 * (installed.json per profile) and the copies VS Code runs (cache.json, only folders that still exist;
 * one under ~/.copilot/installed-plugins counts as the Copilot CLI install). Never throws.
 */
export function getCxDevAssistInstallLocations(options: PluginDetectionOptions = {}): CxDevAssistInstallLocation[] {
	const locations: CxDevAssistInstallLocation[] = [];
	const add = (source: CxDevAssistInstallSource, location: string) => {
		const key = normalizeForMatch(path.resolve(location));
		if (!locations.some(l => normalizeForMatch(path.resolve(l.path)) === key)) {
			locations.push({ source, path: location });
		}
	};
	const cliPath = getCopilotCliInstallPath(options.homeDir);
	if (cliPath) {
		add("copilotCli", cliPath);
	}
	for (const file of getCxDevAssistVsCodeInstalledJsonFiles(options.homeDir, options.userDataDir)) {
		add("vscode", file);
	}
	for (const folder of getCxDevAssistVsCodeCacheFolders(options.userDataDir)) {
		const source: CxDevAssistInstallSource = isCopilotCliFolder(folder) ? "copilotCli" : "vscode";
		if (source === "copilotCli" && locations.some(l => l.source === "copilotCli")) {
			continue;
		}
		add(source, folder);
	}
	return locations;
}

/** Copilot CLI install (~/.copilot/config.json) or VS Code install. Never throws. */
export function isCxDevAssistPluginAvailable(options: PluginDetectionOptions = {}): boolean {
	return getCxDevAssistInstallLocations(options).length > 0;
}

/** "Copilot CLI (<folder>)" / "VS Code (<installed.json or folder>)", joined with "; ". */
export function describeInstallLocations(locations: CxDevAssistInstallLocation[]): string {
	return locations
		.map(location => `${location.source === "copilotCli" ? "Copilot CLI" : "VS Code"} (${location.path})`)
		.join("; ");
}

/** Files whose changes may flip the plugin detection. */
export function getPluginDetectionWatchPaths(context?: Pick<vscode.ExtensionContext, "globalStorageUri">): string[] {
	const paths = [getCopilotConfigPath(), getVsCodeInstalledPluginsPath()];
	const userDataDir = getVsCodeUserDataDir(context);
	if (userDataDir) {
		paths.push(...getVsCodeProfileInstalledPluginsPaths(userDataDir), getVsCodeAgentPluginsCachePath(userDataDir));
	}
	return paths;
}

export function getSelfHealingPromptState(context: vscode.ExtensionContext): SelfHealingPromptState {
	const copilotInstalled = isCopilotInstalled();
	return {
		selfHealingEnabled: isSelfHealingEnabled(),
		copilotInstalled,
		pluginInstalled: copilotInstalled && isCxDevAssistPluginAvailable({ userDataDir: getVsCodeUserDataDir(context) }),
		dismissed: context.globalState.get<boolean>(constants.getSelfHealingDontShowAgainKey(), false) === true,
		shownThisSession,
	};
}

/** Shows at most one install message per session, only while Self-Healing is ON. Never throws. */
export async function maybeShowSelfHealingPrompt(context: vscode.ExtensionContext): Promise<SelfHealingPrompt> {
	try {
		const prompt = decideSelfHealingPrompt(getSelfHealingPromptState(context));
		if (!prompt) {
			return undefined;
		}
		shownThisSession = true;
		const actionButton = prompt === "installCopilot"
			? selfHealingMessages.installCopilotButton
			: selfHealingMessages.installPluginButton;
		const message = prompt === "installCopilot"
			? selfHealingMessages.installCopilot
			: selfHealingMessages.installPlugin;
		void vscode.window
			.showInformationMessage(message, actionButton, selfHealingMessages.dontShowAgainButton)
			.then(async selection => {
				try {
					if (selection === selfHealingMessages.dontShowAgainButton) {
						await context.globalState.update(constants.getSelfHealingDontShowAgainKey(), true);
					} else if (selection === selfHealingMessages.installCopilotButton) {
						await vscode.commands.executeCommand("extension.open", constants.copilotChatExtensionId);
					} else if (selection === selfHealingMessages.installPluginButton) {
						await vscode.commands.executeCommand(commands.installCopilotPlugin);
					}
				} catch (error) {
					currentLogs?.warn(`Self-Healing prompt action failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			});
		return prompt;
	} catch (error) {
		currentLogs?.warn(`Self-Healing prompt failed: ${error instanceof Error ? error.message : String(error)}`);
		return undefined;
	}
}

function isCxAgenticAiMarketplace(entry: unknown): boolean {
	if (typeof entry !== "string") {
		return false;
	}
	const normalized = entry
		.trim()
		.toLowerCase()
		.replace(/#.*$/, "")
		.replace(/^(https?:\/\/)?(www\.)?github\.com\//, "")
		.replace(/\/+$/, "")
		.replace(/\.git$/, "");
	return normalized === constants.cxAgenticAiMarketplaceRepo.toLowerCase();
}

/**
 * Merges Checkmarx/cx-agentic-ai into chat.plugins.marketplaces. Starts from the user value, or from the
 * default (github/awesome-copilot#marketplace) when the user value is unset; existing entries are kept.
 */
export function mergePluginMarketplaces(userValue: unknown, defaultValue?: unknown): { value: unknown[]; changed: boolean } {
	const base: unknown[] = Array.isArray(userValue)
		? [...userValue]
		: Array.isArray(defaultValue)
			? [...defaultValue]
			: [constants.vscodeDefaultPluginMarketplace];
	if (base.some(isCxAgenticAiMarketplace)) {
		return { value: base, changed: false };
	}
	return { value: [...base, constants.cxAgenticAiMarketplaceRepo], changed: true };
}

export interface CopilotCliResult {
	ok: boolean;
	output: string;
}

export interface CopilotCliDeps {
	find: () => string | undefined;
	run: (exe: string, args: string[]) => Promise<CopilotCliResult>;
}

function isFile(filePath: string): boolean {
	try {
		return fs.statSync(filePath).isFile();
	} catch {
		return false;
	}
}

/**
 * The GitHub Copilot CLI: `copilot` on PATH, else the shim VS Code ships in <install>/bin/copilot-shim,
 * a few folders above vscode.env.appRoot. On Windows copilot.exe is preferred over npm's copilot.cmd.
 */
export function findCopilotCli(
	envPath: string = process.env.PATH ?? "",
	appRoot: string | undefined = vscode.env?.appRoot,
	platform: NodeJS.Platform = process.platform
): string | undefined {
	const names = platform === "win32" ? ["copilot.exe", "copilot.cmd"] : ["copilot"];
	const dirs = envPath.split(path.delimiter).filter(Boolean);
	let dir = appRoot;
	for (let i = 0; dir && i < 5; i++) {
		dirs.push(path.join(dir, "bin", "copilot-shim"));
		const parent = path.dirname(dir);
		dir = parent === dir ? undefined : parent;
	}
	for (const d of dirs) {
		for (const name of names) {
			const candidate = path.join(d, name);
			if (isFile(candidate)) {
				return candidate;
			}
		}
	}
	return undefined;
}

/** Runs the Copilot CLI with fixed arguments and no input. Never rejects. */
export function runCopilotCli(exe: string, args: string[]): Promise<CopilotCliResult> {
	// A .cmd (npm's copilot.cmd) only runs through the shell; the arguments are constants
	const viaShell = /\.(cmd|bat)$/i.test(exe);
	return new Promise(resolve => {
		try {
			const child = execFile(
				viaShell ? `"${exe}"` : exe,
				args,
				{ shell: viaShell, windowsHide: true, timeout: 120000 },
				(error, stdout, stderr) => {
					const output = `${stdout ?? ""}${stderr ?? ""}`.trim();
					resolve({ ok: !error, output: output || (error ? error.message : "") });
				}
			);
			child.stdin?.end();
		} catch (error) {
			resolve({ ok: false, output: error instanceof Error ? error.message : String(error) });
		}
	});
}

const defaultCopilotCliDeps: CopilotCliDeps = { find: () => findCopilotCli(), run: runCopilotCli };
let copilotCliDeps = defaultCopilotCliDeps;

/** For tests only: replaces how the Copilot CLI is found and run (undefined restores the default). */
export function setCopilotCliDeps(deps?: CopilotCliDeps): void {
	copilotCliDeps = deps ?? defaultCopilotCliDeps;
}

/** copilot plugin marketplace add ..., then copilot plugin install ...; the install result decides. */
async function installWithCopilotCli(cli: string): Promise<CopilotCliResult> {
	const [addArgs, installArgs] = constants.cxDevAssistPluginCliInstallArgs;
	const added = await copilotCliDeps.run(cli, addArgs);
	if (!added.ok) {
		// Usually the marketplace is already added; the install below reports any real problem
		currentLogs?.info(`copilot ${addArgs.join(" ")}: ${added.output}`);
	}
	return copilotCliDeps.run(cli, installArgs);
}

/** "...is already installed: Copilot CLI (<folder>)." or "...is already installed." */
export function alreadyInstalledMessage(locations: CxDevAssistInstallLocation[]): string {
	return locations.length > 0
		? `${selfHealingMessages.pluginAlreadyInstalled}: ${describeInstallLocations(locations)}.`
		: `${selfHealingMessages.pluginAlreadyInstalled}.`;
}

/** Offers to install GitHub Copilot when it is missing; true when it is installed. */
async function ensureCopilotInstalled(): Promise<boolean> {
	if (isCopilotInstalled()) {
		return true;
	}
	const selection = await vscode.window.showInformationMessage(
		selfHealingMessages.installCopilot,
		selfHealingMessages.installCopilotButton
	);
	if (selection === selfHealingMessages.installCopilotButton) {
		await vscode.commands.executeCommand("extension.open", constants.copilotChatExtensionId);
	}
	return false;
}

/**
 * Installs cx-devassist with the GitHub Copilot CLI (VS Code also runs plugins the Copilot CLI installed):
 * first GitHub Copilot must be installed, then an existing install is reported with its location instead
 * of installing again. Without the Copilot CLI it falls back to VS Code's plugin browser. Never throws.
 */
export async function installCopilotPluginInVsCode(context?: Pick<vscode.ExtensionContext, "globalStorageUri">): Promise<void> {
	try {
		if (!(await ensureCopilotInstalled())) {
			return;
		}
		const locations = getCxDevAssistInstallLocations({ userDataDir: getVsCodeUserDataDir(context) });
		if (locations.length > 0) {
			currentLogs?.info(alreadyInstalledMessage(locations));
			void vscode.window.showInformationMessage(alreadyInstalledMessage(locations));
			return;
		}
		const cli = copilotCliDeps.find();
		if (!cli) {
			currentLogs?.warn("GitHub Copilot CLI not found; opening the VS Code plugin browser instead");
			void vscode.window.showInformationMessage(selfHealingMessages.copilotCliNotFound);
			await openVsCodePluginBrowser();
			return;
		}
		const result = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: selfHealingMessages.installingPlugin },
			() => installWithCopilotCli(cli)
		);
		if (result.ok) {
			currentLogs?.info(`Installed the Checkmarx Copilot plugin with ${cli}`);
			void vscode.window.showInformationMessage(selfHealingMessages.pluginInstalled);
			return;
		}
		if (/already installed/i.test(result.output)) {
			void vscode.window.showInformationMessage(alreadyInstalledMessage([{ source: "copilotCli", path: getCopilotCliPluginDir() }]));
			return;
		}
		currentLogs?.error(`${selfHealingMessages.pluginInstallFailed} ${result.output}`);
		const reason = result.output.split(/\r?\n/).find(line => line.trim()) ?? "";
		const selection = await vscode.window.showErrorMessage(
			`${selfHealingMessages.pluginInstallFailed} ${reason}`.trim(),
			selfHealingMessages.openPluginBrowserButton
		);
		if (selection === selfHealingMessages.openPluginBrowserButton) {
			await openVsCodePluginBrowser();
		}
	} catch (error) {
		currentLogs?.error(`${selfHealingMessages.pluginInstallFailed} ${error instanceof Error ? error.message : String(error)}`);
	}
}

/** Adds the Checkmarx marketplace to the user settings and opens VS Code's plugin browser. Never throws. */
export async function openVsCodePluginBrowser(): Promise<void> {
	try {
		const config = vscode.workspace.getConfiguration(constants.vscodePluginMarketplacesSection);
		const inspected = config.inspect<unknown>(constants.vscodePluginMarketplacesKey);
		const { value, changed } = mergePluginMarketplaces(inspected?.globalValue, inspected?.defaultValue);
		if (changed) {
			await config.update(constants.vscodePluginMarketplacesKey, value, vscode.ConfigurationTarget.Global);
		}
	} catch (error) {
		currentLogs?.warn(`${selfHealingMessages.marketplaceUpdateFailed} ${error instanceof Error ? error.message : String(error)}`);
		void vscode.window.showWarningMessage(selfHealingMessages.marketplaceUpdateFailed);
	}
	try {
		await vscode.commands.executeCommand(constants.vscodeBrowseAgentPluginsCommand);
	} catch (error) {
		currentLogs?.warn(`Could not open the VS Code plugin browser: ${error instanceof Error ? error.message : String(error)}`);
		void vscode.window.showInformationMessage(selfHealingMessages.browsePluginsFallback);
	}
}

export async function showInstallCopilotPluginHelp(context?: Pick<vscode.ExtensionContext, "globalStorageUri">): Promise<void> {
	const selection = await vscode.window.showInformationMessage(
		selfHealingMessages.pluginHelp,
		selfHealingMessages.installInVsCodeButton,
		selfHealingMessages.copyCommandsButton,
		selfHealingMessages.openGuideButton
	);
	if (selection === selfHealingMessages.installInVsCodeButton) {
		await installCopilotPluginInVsCode(context);
	} else if (selection === selfHealingMessages.copyCommandsButton) {
		await vscode.env.clipboard.writeText(constants.cxDevAssistPluginInstallCommands.join("\n"));
		vscode.window.showInformationMessage(selfHealingMessages.commandsCopied);
	} else if (selection === selfHealingMessages.openGuideButton) {
		await vscode.env.openExternal(vscode.Uri.parse(constants.cxDevAssistPluginGuideUrl));
	}
}

/**
 * Checkmarx Self-Healing drives the cx-devassist Copilot plugin inside GitHub Copilot in Visual Studio Code
 * (stable and Insiders) only. The same extension also runs in VS Code forks (Cursor, Windsurf, Kiro,
 * Devin, ...), where it must do nothing: above all it must not write the shared
 * ~/.checkmarx/cx-onboarding-ide.properties, or a fork's setting would overwrite the user's VS Code choice.
 */
export function isSelfHealingSupportedHost(appName: string = vscode.env?.appName ?? ""): boolean {
	return appName.toLowerCase().includes(constants.vsCodeAgentOrginalName.toLowerCase());
}

/** Called at the end of a successful login: write the settings to the file, then evaluate the install messages. */
export async function onSelfHealingPostAuth(context: vscode.ExtensionContext, logs?: Logs): Promise<void> {
	if (!isSelfHealingSupportedHost()) {
		return;
	}
	setIdeOnboardingAuthenticated(true);
	syncIdeOnboardingProperties(context, logs ?? currentLogs);
	promptArmed = true;
	await maybeShowSelfHealingPrompt(context);
}

/** Called on logout: the file then says Self-Healing and every scanner are OFF. Never throws. */
export function onSelfHealingLogout(context?: vscode.ExtensionContext, logs?: Logs): void {
	if (!isSelfHealingSupportedHost()) {
		return;
	}
	setIdeOnboardingAuthenticated(false);
	promptArmed = false;
	syncIdeOnboardingProperties(context, logs ?? currentLogs);
}

/** Logged in when the credential is stored; re-syncs the file. Covers activation and other windows. */
async function syncAuthFromSecrets(context: vscode.ExtensionContext, logs: Logs): Promise<void> {
	let token: string | undefined;
	try {
		token = await context.secrets.get(constants.getAuthCredentialSecretKey());
	} catch (error) {
		logs.warn(`Could not read the Checkmarx credential: ${error instanceof Error ? error.message : String(error)}`);
	}
	setIdeOnboardingAuthenticated(!!token);
	syncIdeOnboardingProperties(context, logs);
}

function sendSelfHealingTelemetry(enabled: boolean): void {
	try {
		Promise.resolve(
			cx.setUserEventDataForLogs("settings", enabled ? "selfHealingEnabled" : "selfHealingDisabled", "", "")
		).catch(() => undefined);
	} catch {
		// Telemetry is best effort
	}
}

/**
 * Registers the install-help command, the settings listener and the plugin file watchers
 * (~/.copilot/config.json, ~/.vscode/agent-plugins/installed.json, <user-data>/agentPlugins/cache.json),
 * and writes the properties file once on activation, as logged in or logged out.
 */
export function registerSelfHealing(context: vscode.ExtensionContext, logs: Logs): void {
	currentLogs = logs;
	if (!isSelfHealingSupportedHost()) {
		// VS Code forks: only the command declared in package.json, explaining it is VS Code only. No
		// file write, listeners, watchers, install messages or telemetry.
		context.subscriptions.push(
			vscode.commands.registerCommand(commands.installCopilotPlugin, () =>
				vscode.window.showInformationMessage(selfHealingMessages.vsCodeOnly)
			)
		);
		return;
	}
	try {
		registerSelfHealingListeners(context, logs);
	} catch (error) {
		logs.error(`Failed to register Checkmarx Self-Healing: ${error instanceof Error ? error.message : String(error)}`);
	}
	void syncAuthFromSecrets(context, logs);
}

function registerSelfHealingListeners(context: vscode.ExtensionContext, logs: Logs): void {
	context.subscriptions.push(
		vscode.commands.registerCommand(commands.installCopilotPlugin, () => showInstallCopilotPluginHelp(context))
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			const keys = getIdeOnboardingConfigKeys();
			if (!keys.some(key => event.affectsConfiguration(key))) {
				return;
			}
			syncIdeOnboardingProperties(context, logs);
			if (event.affectsConfiguration(keys[0])) {
				const enabled = isSelfHealingEnabled();
				sendSelfHealingTelemetry(enabled);
				if (enabled) {
					promptArmed = true;
					void maybeShowSelfHealingPrompt(context);
				}
			}
		})
	);

	context.subscriptions.push(
		context.secrets.onDidChange(event => {
			if (event.key === constants.getAuthCredentialSecretKey()) {
				void syncAuthFromSecrets(context, logs);
			}
		})
	);

	const listener = () => {
		if (promptArmed) {
			void maybeShowSelfHealingPrompt(context);
		}
	};
	for (const watchPath of getPluginDetectionWatchPaths(context)) {
		try {
			fs.watchFile(watchPath, { interval: 5000, persistent: false }, listener);
			context.subscriptions.push({ dispose: () => fs.unwatchFile(watchPath, listener) });
		} catch (error) {
			logs.warn(`Failed to watch ${watchPath}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}

/** For tests only. */
export function resetSelfHealingSessionState(): void {
	shownThisSession = false;
	promptArmed = false;
	setIdeOnboardingAuthenticated(false);
}
