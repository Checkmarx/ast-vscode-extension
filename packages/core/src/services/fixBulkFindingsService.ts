import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { ReviewFinding } from "./securityReviewService";
import { CxDiagnosticData } from "../realtimeScanners/common/types";
import { isCheckmarxDiagnostic } from "./securityReviewService";
import { getRepositoryRoot } from "../utils/gitDiff";
import { resolveSecurityReviewSettings } from "../utils/securityReviewPolicy";
import { commands } from "../utils/common/commandBuilder";

/**
 * Service for "Fix Bulk Findings" button
 *
 * Provides categorized remediation options:
 * 1. Remediate All OSS (SCA/package vulnerabilities)
 * 2. Remediate All ASCA (code vulnerabilities)
 * 3. Remediate All Secrets (hardcoded credentials)
 * 4. Remediate All Containers (container image issues)
 * 5. Remediate All IaC (infrastructure as code)
 *
 * User selects category → system generates targeted prompt → sends to Claude/Copilot
 */
export class FixBulkFindingsService {
	private logs: Logs;
	private statusBarItem: vscode.StatusBarItem | undefined;
	private disposables: vscode.Disposable[] = [];

	// Category definitions
	private readonly categories = [
		{
			id: "oss",
			label: "Remediate All OSS",
			description: "Fix vulnerable packages (SCA findings)",
			engine: "oss" as const,
		},
		{
			id: "asca",
			label: "Remediate All ASCA",
			description: "Fix code vulnerabilities (SAST findings)",
			engine: "asca" as const,
		},
		{
			id: "secrets",
			label: "Remediate All Secrets",
			description: "Remove hardcoded credentials and secrets",
			engine: "secrets" as const,
		},
		{
			id: "containers",
			label: "Remediate All Containers",
			description: "Fix container image vulnerabilities",
			engine: "containers" as const,
		},
		{
			id: "iac",
			label: "Remediate All IaC",
			description: "Fix infrastructure as code issues",
			engine: "iac" as const,
		},
	];

	constructor(logs: Logs) {
		this.logs = logs;
	}

	public async initialize(): Promise<void> {
		this.createStatusBarButton();
		this.registerCommands();
		this.setupDiagnosticListener();
		this.logs.info("FixBulkFindingsService initialized");
	}

	private createStatusBarButton(): void {
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			100
		);
		this.statusBarItem.command = "checkmarx.fixBulkFindings";
		this.statusBarItem.text = "🔧 Fix Bulk Findings";
		this.statusBarItem.tooltip = "Select vulnerability category to remediate";
		this.statusBarItem.hide(); // Hidden until findings appear
		this.disposables.push(this.statusBarItem);
	}

	private registerCommands(): void {
		const cmd = vscode.commands.registerCommand(
			"checkmarx.fixBulkFindings",
			async () => {
				await this.showCategoryOptions();
			}
		);
		this.disposables.push(cmd);
	}

	private setupDiagnosticListener(): void {
		if (vscode.languages.onDidChangeDiagnostics) {
			const listener = vscode.languages.onDidChangeDiagnostics(() => {
				this.updateStatusBarVisibility();
			});
			this.disposables.push(listener);
		}
	}

	private updateStatusBarVisibility(): void {
		if (!this.statusBarItem) return;

		const hasCheckmarxFindings = this.hasCheckmarxDiagnostics();
		if (hasCheckmarxFindings) {
			this.statusBarItem.show();
		} else {
			this.statusBarItem.hide();
		}
	}

	private hasCheckmarxDiagnostics(): boolean {
		const allDiagnostics = vscode.languages.getDiagnostics();
		for (const [, diagnostics] of allDiagnostics) {
			if (diagnostics.some((d) => isCheckmarxDiagnostic(d))) {
				return true;
			}
		}
		return false;
	}

	private async showCategoryOptions(): Promise<void> {
		try {
			const findings = this.extractCheckmarxFindings();

			if (findings.length === 0) {
				vscode.window.showInformationMessage(
					"✅ No Checkmarx vulnerabilities found in the workspace!"
				);
				return;
			}

			// Count findings by category
			const counts = this.countFindingsByCategory(findings);

			// Filter categories with findings
			const availableCategories = this.categories.filter((cat) => counts[cat.id] > 0);

			if (availableCategories.length === 0) {
				vscode.window.showInformationMessage(
					"✅ No Checkmarx vulnerabilities found in the workspace!"
				);
				return;
			}

			// Show quick pick with categories
			const selected = await vscode.window.showQuickPick(
				availableCategories.map((cat) => ({
					label: `${cat.label} (${counts[cat.id]} finding${counts[cat.id] === 1 ? "" : "s"})`,
					description: cat.description,
					id: cat.id,
					category: cat,
					count: counts[cat.id],
				})),
				{
					title: "Select Vulnerability Category to Remediate",
					placeHolder: "Choose a category...",
					matchOnDescription: true,
				}
			);

			if (!selected) {
				return; // User cancelled
			}

			// Get findings for selected category
			const categoryFindings = findings.filter(
				(f) => f.engine === selected.category.engine
			);

			// Generate and submit prompt
			await this.submitRemediationPrompt(selected.category, categoryFindings);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.logs.error(`Fix Bulk Findings failed: ${message}`);
			vscode.window.showErrorMessage(`Failed to fix bulk findings: ${message}`);
		}
	}

	private countFindingsByCategory(findings: ReviewFinding[]): Record<string, number> {
		const counts: Record<string, number> = {
			oss: 0,
			asca: 0,
			secrets: 0,
			containers: 0,
			iac: 0,
		};

		findings.forEach((f) => {
			counts[f.engine]++;
		});

		return counts;
	}

	private async submitRemediationPrompt(
		category: (typeof this.categories)[number],
		findings: ReviewFinding[]
	): Promise<void> {
		const prompt = this.generateCategoryPrompt(category, findings);

		await vscode.commands.executeCommand(commands.openAIChatWithPrompt, prompt, {
			newChat: false,
		});

		const message = `Opened AI chat for ${category.label} (${findings.length} finding${findings.length === 1 ? "" : "s"})`;
		vscode.window.showInformationMessage(message);
		this.logs.info(message);
	}

	private generateCategoryPrompt(
		category: (typeof this.categories)[number],
		findings: ReviewFinding[]
	): string {
		const findingCount = findings.length;
		const findingsSummary = findings
			.slice(0, 5)
			.map(
				(f, idx) =>
					`${idx + 1}. [${f.severity.toUpperCase()}] ${f.filePath}:${f.line} - ${f.message}`
			)
			.join("\n");

		const showMore =
			findingCount > 5 ? `\n... and ${findingCount - 5} more finding(s)` : "";

		// Category-specific instructions
		const categoryInstructions = this.getCategoryInstructions(category.engine);

		return `@problem-window **${category.label}**

You are a security-focused code reviewer with access to Checkmarx MCP tools for automated remediation.

## Summary
- **Category:** ${category.label}
- **Total Findings:** ${findingCount}
- **Scope:** All ${category.engine.toUpperCase()} security findings

## Findings Preview
${findingsSummary}${showMore}

## MCP Tools Available
${categoryInstructions.tools}

## Action Plan
${categoryInstructions.actionPlan}

## Requirements
- ✅ ALL ${findingCount} ${category.engine.toUpperCase()} findings must be addressed
- ✅ Use appropriate MCP tool(s) for this category
- ✅ Code must pass linting and tests
- ✅ Changes must maintain backward compatibility
- ✅ Commit messages should reference the vulnerability type fixed

## Output
After completing the fixes, provide:
1. **Summary** of security issues resolved (with MCP tool used for each)
2. **Files Modified** list
3. **Test Results** (pass/fail + coverage if available)
4. **Recommendations** for any remaining improvements
5. **Merge Readiness** checklist (ready ✅ / needs review 🔄)

Begin by using Checkmarx MCP tools to implement automated fixes for all ${findingCount} findings.`;
	}

	private getCategoryInstructions(engine: string): {
		tools: string;
		actionPlan: string;
	} {
		switch (engine) {
			case "oss":
				return {
					tools: `- **listFindings** — Get all vulnerable packages
- **packageRemediation** — Automatically upgrade to patched versions
- **getFindingDetails** — Get package vulnerability context`,
					actionPlan: `1. Call **listFindings** to get complete list of ALL ${this.countFindingsByCategory(this.extractCheckmarxFindings()).oss} vulnerable packages
2. For each vulnerable package:
   - Call **packageRemediation MCP tool** to automatically upgrade to patched version
3. Run tests:
   \`\`\`bash
   npm install
   npm run lint
   npm run unit-test:core
   \`\`\`
4. Generate summary showing which packages were upgraded and their new versions`,
				};
			case "asca":
				return {
					tools: `- **listFindings** — Get all code vulnerabilities
- **codeRemediation** — Automatically apply security fixes to code
- **getFindingDetails** — Get vulnerability context and remediation guidance`,
					actionPlan: `1. Call **listFindings** to get complete list of ALL code vulnerabilities
2. For each code vulnerability:
   - Call **codeRemediation MCP tool** to automatically apply security fix
   - Examples: SQL injection → parameterized queries, XSS → output sanitization, etc.
3. Run tests:
   \`\`\`bash
   npm install
   npm run lint
   npm run unit-test:core
   \`\`\`
4. Generate summary showing which code vulnerabilities were fixed`,
				};
			case "secrets":
				return {
					tools: `- **listFindings** — Get all hardcoded secrets
- **getFindingDetails** — Get secret location and context`,
					actionPlan: `1. Call **listFindings** to get complete list of ALL hardcoded secrets
2. For each secret:
   - Remove hardcoded credential from code
   - Move to environment variable or secrets manager
   - Update code to read from secure location
3. Run tests:
   \`\`\`bash
   npm install
   npm run lint
   npm run unit-test:core
   \`\`\`
4. Generate summary showing which secrets were moved to secure storage`,
				};
			case "containers":
				return {
					tools: `- **listFindings** — Get all container vulnerabilities
- **imageRemediation** — Automatically update base images to patched versions
- **getFindingDetails** — Get image vulnerability context`,
					actionPlan: `1. Call **listFindings** to get complete list of ALL container vulnerabilities
2. For each container image:
   - Call **imageRemediation MCP tool** to automatically update base image
   - Examples: node:12 → node:18, ubuntu:18.04 → ubuntu:22.04, etc.
3. Update Dockerfile(s) with new images
4. Run tests:
   \`\`\`bash
   npm install
   npm run lint
   npm run unit-test:core
   \`\`\`
5. Generate summary showing which images were updated`,
				};
			case "iac":
				return {
					tools: `- **listFindings** — Get all IaC configuration issues
- **getFindingDetails** — Get configuration guidance and remediation recommendations`,
					actionPlan: `1. Call **listFindings** to get complete list of ALL IaC issues
2. For each IaC configuration issue:
   - Review security configuration (encryption, permissions, logging, etc.)
   - Apply security best practices
   - Update configuration files (Terraform, CloudFormation, Kubernetes, etc.)
3. Run tests:
   \`\`\`bash
   npm install
   npm run lint
   npm run unit-test:core
   \`\`\`
4. Generate summary showing which IaC configurations were hardened`,
				};
			default:
				return {
					tools: `- **listFindings** — Get all findings for this category
- **getFindingDetails** — Get finding context`,
					actionPlan: `1. Get all findings for this category
2. Apply appropriate fixes using relevant MCP tools
3. Run tests
4. Generate summary`,
				};
		}
	}

	private extractCheckmarxFindings(): ReviewFinding[] {
		const findings: ReviewFinding[] = [];
		const allDiagnostics = vscode.languages.getDiagnostics();

		for (const [uri, diagnostics] of allDiagnostics) {
			const filtered = diagnostics.filter((d) => isCheckmarxDiagnostic(d));

			filtered.forEach((diagnostic) => {
				const data = (diagnostic as vscode.Diagnostic & { data?: CxDiagnosticData })
					.data;
				const item = data?.item as
					| { severity?: string; status?: string }
					| undefined;
				const rawSeverity = item?.severity ?? item?.status;

				const severity = this.normalizeSeverity(
					rawSeverity ? String(rawSeverity) : "info"
				);

				const finding: ReviewFinding = {
					engine: this.extractEngine(diagnostic.source),
					filePath: uri.fsPath,
					line: diagnostic.range.start.line + 1,
					severity,
					message: diagnostic.message,
					diagnostic,
					uri,
				};

				findings.push(finding);
			});
		}

		return findings;
	}

	private extractEngine(
		source: string | undefined
	): "asca" | "oss" | "secrets" | "iac" | "containers" | "kics" {
		const src = (source ?? "").toLowerCase();
		if (src.includes("asca")) return "asca";
		if (src.includes("oss") || src.includes("sca")) return "oss";
		if (src.includes("secret")) return "secrets";
		if (src.includes("iac")) return "iac";
		if (src.includes("container")) return "containers";
		if (src.includes("kics")) return "iac"; // KICS is IaC
		return "asca";
	}

	private normalizeSeverity(
		value: string
	): "critical" | "high" | "medium" | "low" | "info" {
		const normalized = value.toUpperCase();

		if (normalized.includes("CRITICAL") || normalized === "MALICIOUS") {
			return "critical";
		}
		if (normalized.includes("HIGH")) {
			return "high";
		}
		if (normalized.includes("MEDIUM")) {
			return "medium";
		}
		if (normalized.includes("LOW")) {
			return "low";
		}

		return "info";
	}

	public dispose(): void {
		this.disposables.forEach((d) => d.dispose());
	}
}
