import * as vscode from "vscode";
import CxScaRealtime from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scaRealtime/CxScaRealTime";
import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxProject from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/project/CxProject";
import CxCodeBashing from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/codebashing/CxCodeBashing";
import { CxConfig } from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import { getFilePath } from "../utils/utils";
import { writeFileSync } from "fs";
import { CxPlatform } from "./cxPlatform";
import CxVorpal from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/vorpal/CxVorpal";
import { EMPTY_RESULTS_SCAN_ID } from "../test/utils/envs";

export let isInstallVorpal = false;
export let scanVorpalNum = 0;
export class CxMock implements CxPlatform {

	
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async scaScanCreate(): Promise<CxScaRealtime[] | any> {
		return [
			{
				type: "Regular",
				scaType: "vulnerability",
				label: "sca",
				severity: "HIGH",
				description: "decode-uri-component is vulnerable to Improper Input Validation resulting in DoS.",
				data: {
					nodes: [
						{
							line: 0,
							column: 0,
							fileName: "package.json",
						},
					],
					packageData: [
						{
							type: "Advisory",
							url: "https://github.com/advisories/GHSA-w573-4hg7-7wgq",
						},
						{
							type: "Issue",
							url: "https://github.com/SamVerschueren/decode-uri-component/issues/5",
						},
						{
							type: "Vulnerable code",
							url: "https://github.com/SamVerschueren/decode-uri-component/blob/v0.2.0/index.js#L29",
						},
					],
					packageIdentifier: "decode-uri-component",
					scaPackageData: {
						fixLink: "https://devhub.checkmarx.com/cve-details/CVE-2022-38900",
						supportsQuickFix: false,
						isDirectDependency: false,
						typeOfDependency: "",
					},
				},
				comments: {
				},
				vulnerabilityDetails: {
					cweId: "CVE-2022-38900",
					cvssScore: 7.5,
					cveName: "CVE-2022-38900",
					cvss: {
						version: 2,
						attackVector: "NETWORK",
						availability: "HIGH",
						confidentiality: "NONE",
						attackComplexity: "LOW",
						integrityImpact: "NONE",
						scope: "UNCHANGED",
						privilegesRequired: "NONE",
						userInteraction: "NONE",
					},
				},
			}
		];
	}

	async scanCreate() {
		return {
			tags: {
			},
			groups: undefined,
			id: "1",
			projectID: "2588deba-1751-4afc-b7e3-db71727a1edd",
			status: "Completed",
			createdAt: "2023-04-19T10:07:37.628413+01:00",
			updatedAt: "2023-04-19T09:08:27.151913Z",
			origin: "grpc-java-netty 1.35.0",
			initiator: "tiago",
			branch: "main",
		};
	}

	async scanCancel() {
		return true;
	}

	async getResults(scanId: string) {
		let results;
		
		if (scanId === "2"||scanId === EMPTY_RESULTS_SCAN_ID) {
			results = {
				"results": []
			};
		}
		else{
			results =  {
				"results": [
					{
						"type": "kics",
						"label": "IaC Security",
						"id": "150256",
						"similarityId": "92742543fa8505b3ba24ff54894c94594d0d9e3873b05fb38dbcbdef40aa3062",
						"status": "NEW",
						"state": "TO_VERIFY",
						"severity": "LOW",
						"created": "2022-09-02T10:45:29Z",
						"firstFoundAt": "2022-08-26T10:28:36Z",
						"foundAt": "2022-09-02T10:45:29Z",
						"firstScanId": "cb834dcd-aaec-4e1f-a099-089d5fbe503e",
						"description": "Ensure that HEALTHCHECK is being used. The HEALTHCHECK instruction tells Docker how to test a container to check that it is still working",
						"descriptionHTML": "\u003cp\u003eEnsure that HEALTHCHECK is being used. The HEALTHCHECK instruction tells Docker how to test a container to check that it is still working\u003c/p\u003e\n",
						"data": {
							"queryId": "b03a748a-542d-44f4-bb86-9199ab4fd2d5 [Taken from query_id]",
							"queryName": "Healthcheck Instruction Missing",
							"group": "Insecure Configurations [Taken from category]",
							"line": 3,
							"platform": "Dockerfile",
							"issueType": "MissingAttribute",
							"expectedValue": "Dockerfile contains instruction 'HEALTHCHECK'",
							"value": "Dockerfile doesn't contain instruction 'HEALTHCHECK'",
							"filename": "/Dockerfile"
						},
						"comments": {},
						"vulnerabilityDetails": {
							"cvss": {}
						}
					},
					{
						"type": "kics",
						"label": "IaC Security",
						"id": "150255",
						"similarityId": "bca11aa6fe8840e47585aaa38048073afc521dc953151be020fb8fc4cc38f54a",
						"status": "NEW",
						"state": "TO_VERIFY",
						"severity": "MEDIUM",
						"created": "2022-09-02T10:45:29Z",
						"firstFoundAt": "2022-08-26T10:28:36Z",
						"foundAt": "2022-09-02T10:45:29Z",
						"firstScanId": "cb834dcd-aaec-4e1f-a099-089d5fbe503e",
						"description": "Package version pinning reduces the range of versions that can be installed, reducing the chances of failure due to unanticipated changes",
						"descriptionHTML": "\u003cp\u003ePackage version pinning reduces the range of versions that can be installed, reducing the chances of failure due to unanticipated changes\u003c/p\u003e\n",
						"data": {
							"queryId": "d3499f6d-1651-41bb-a9a7-de925fea487b [Taken from query_id]",
							"queryName": "Unpinned Package Version in Apk Add",
							"group": "Supply-Chain [Taken from category]",
							"line": 6,
							"platform": "Dockerfile",
							"issueType": "IncorrectValue",
							"expectedValue": "RUN instruction with 'apk add \u003cpackage\u003e' should use package pinning form 'apk add \u003cpackage\u003e=\u003cversion\u003e'",
							"value": "RUN instruction apk --no-cache add git python3 py-lxml     \u0026\u0026 rm -rf /var/cache/apk/* does not use package pinning form",
							"filename": "/Dockerfile"
						},
						"comments": {},
						"vulnerabilityDetails": {
							"cvss": {}
						}
					},
					{
						"type": "sast",
						"label": "sast",
						"id": "255181",
						"similarityId": "-1792929011",
						"status": "NEW",
						"state": "TO_VERIFY",
						"severity": "HIGH",
						"created": "2022-09-02T10:45:54Z",
						"firstFoundAt": "2022-08-26T10:28:57Z",
						"foundAt": "2022-09-02T10:45:54Z",
						"firstScanId": "cb834dcd-aaec-4e1f-a099-089d5fbe503e",
						"description": "The method $PageLoad embeds untrusted data in generated output with echo, at line 11 of /insecure.php. This untrusted data is embedded into the output without proper sanitization or encoding, enabling an attacker to inject malicious code into the generated web-page.\n\nThe attacker would be able to alter the returned web page by simply providing modified data in the user input _POST, which is read by the $PageLoad method at line 10 of /insecure.php. This input then flows through the code straight to the output web page, without sanitization. \r\n\r\nThis can enable a Reflected Cross-Site Scripting (XSS) attack.\n\n",
						"descriptionHTML": "\u003cp\u003eThe method $PageLoad embeds untrusted data in generated output with echo, at line 11 of /insecure.php. This untrusted data is embedded into the output without proper sanitization or encoding, enabling an attacker to inject malicious code into the generated web-page.\u003c/p\u003e\n\n\u003cp\u003eThe attacker would be able to alter the returned web page by simply providing modified data in the user input _POST, which is read by the $PageLoad method at line 10 of /insecure.php. This input then flows through the code straight to the output web page, without sanitization. \r\n\r\nThis can enable a Reflected Cross-Site Scripting (XSS) attack.\u003c/p\u003e\n",
						"data": {
							// eslint-disable-next-line @typescript-eslint/no-loss-of-precision
							"queryId": 5157925289005576664,
							"queryName": "Reflected_XSS_All_Clients",
							"group": "PHP_High_Risk",
							"resultHash": "ZGJRP6tLG66K4GwKarVTE8GDL/M=",
							"languageName": "PHP",
							"nodes": [
								{
									"id": "6BkcV9Pylb1Kk14z/xZHkWcP9hk=",
									"line": 10,
									"name": "_POST",
									"column": 8,
									"length": 6,
									"method": "$PageLoad",
									"nodeID": 164,
									"domType": "UnknownReference",
									"fileName": "/insecure.php",
									"fullName": "$NS_insecure_a3ce4a23.$Cls_insecure_a3ce4a23._POST",
									"typeName": "CxDefaultObject",
									"methodLine": 1,
									"definitions": "1"
								},
								{
									"id": "o8XLDcRzoLEzVVdI3yyHchg/JH0=",
									"line": 10,
									"name": "var",
									"column": 1,
									"length": 4,
									"method": "$PageLoad",
									"nodeID": 168,
									"domType": "UnknownReference",
									"fileName": "/insecure.php",
									"fullName": "$NS_insecure_a3ce4a23.$Cls_insecure_a3ce4a23.var",
									"typeName": "CxDefaultObject",
									"methodLine": 1,
									"definitions": "1"
								},
								{
									"id": "yis1SnpLBtDSuxZBPhw76TaDjY4=",
									"line": 11,
									"name": "var",
									"column": 12,
									"length": 4,
									"method": "$PageLoad",
									"nodeID": 184,
									"domType": "UnknownReference",
									"fileName": "/insecure.php",
									"fullName": "$NS_insecure_a3ce4a23.$Cls_insecure_a3ce4a23.var",
									"typeName": "CxDefaultObject",
									"methodLine": 1,
									"definitions": "1"
								},
								{
									"id": "kZuPO2VpUX+yVNtYvSP3FVHVJBQ=",
									"line": 11,
									"name": "$_DoubleQuotedString",
									"column": 0,
									"length": 20,
									"method": "$PageLoad",
									"nodeID": 177,
									"domType": "MethodInvokeExpr",
									"fileName": "/insecure.php",
									"fullName": "$_DoubleQuotedString",
									"typeName": "$_DoubleQuotedString",
									"methodLine": 1,
									"definitions": "0"
								},
								{
									"id": "fO7BgAMUgzMTXcmTFe9v8TGpYPg=",
									"line": 11,
									"name": "echo",
									"column": 1,
									"length": 4,
									"method": "$PageLoad",
									"nodeID": 171,
									"domType": "MethodInvokeExpr",
									"fileName": "/insecure.php",
									"fullName": "echo",
									"typeName": "echo",
									"methodLine": 1,
									"definitions": "0"
								}
							]
						},
						"comments": {},
						"vulnerabilityDetails": {
							"cweId": 79,
							"cvss": {},
							"compliances": [
								"PCI DSS v3.2.1",
								"ASD STIG 4.10",
								"FISMA 2014",
								"NIST SP 800-53",
								"OWASP Top 10 2013",
								"OWASP Top 10 2017",
								"OWASP Top 10 2021"
							]
						}
					},
					{
						"type": "sca",
						"scaType": "Vulnerability",
						"label": "sca",
						"id": "cve-2011-3374",
						"similarityId": "cve-2011-3374",
						"status": "RECURRENT",
						"state": "TO_VERIFY",
						"severity": "LOW",
						"created": "2023-04-21T10:34:40Z",
						"firstFoundAt": "2023-02-23T12:19:31Z",
						"foundAt": "2023-04-21T10:34:40Z",
						"firstScanId": "eaa0f3ea-ce32-4059-9836-db13d16fb2c8",
						"description": "It was found that apt-key in apt, all versions, do not correctly validate gpg keys with the master keyring, leading to a potential man-in-the-middle attack.",
						"descriptionHTML": "\u003cp\u003eIt was found that apt-key in apt, all versions, do not correctly validate gpg keys with the master keyring, leading to a potential man-in-the-middle attack.\u003c/p\u003e\n",
						"data": {},
						"comments": {},
						"vulnerabilityDetails": {
							"cweId": "CWE-347",
							"cvssScore": 3.7,
							"cvss": {
								"version": 3,
								"attackVector": "NETWORK",
								"availability": "NONE",
								"confidentiality": "NONE",
								"attackComplexity": "HIGH"
							}
						}
					}
				]
			};
		}
		writeFileSync(getFilePath() + "/ast-results.json", JSON.stringify(results), {
			flag: 'w+',
		});
	}

	async getScan(scanId: string): Promise<CxScan | undefined> {
		
		if (scanId===(EMPTY_RESULTS_SCAN_ID)) {
			return{
				tags: {
				},
				groups: undefined,
				id: EMPTY_RESULTS_SCAN_ID,
				projectID: "EmptyResultsProjectId",
				status: "Completed",
				createdAt: "2023-03-19T15:10:38.749899+01:00",
				updatedAt: "2023-03-19T14:11:42.892326Z",
				origin: "grpc-java-netty 1.35.0",
				initiator: "tester",
				branch: "main",
			}} 
		return {
			tags: {
			},
			groups: undefined,
			id: "1",
			projectID: "2588deba-1751-4afc-b7e3-db71727a1edd",
			status: "Completed",
			createdAt: "2023-04-19T10:07:37.628413+01:00",
			updatedAt: "2023-04-19T09:08:27.151913Z",
			origin: "grpc-java-netty 1.35.0",
			initiator: "tiago",
			branch: "main",
		};
	}

	async getProject(projectId: string): Promise<CxProject | undefined> {
		
		if(projectId==="EmptyResultsProjectId"){
			return{
				tags: {
				},
				groups: [
				],
				id: "EmptyResultsProjectId",
				name: "EmptyResultsProjectName",
				createdAt: "2023-04-19T09:07:36.846145Z",
				updatedAt: "2023-04-19T09:07:36.846145Z",
			}
		}
		return {
			tags: {
			},
			groups: [
			],
			id: "1",
			name: "test-proj-21",
			createdAt: "2023-04-19T09:07:36.846145Z",
			updatedAt: "2023-04-19T09:07:36.846145Z",
		};
	}

	async getProjectList(): Promise<CxProject[] | undefined> {
		return [
			{
				tags: {
					integration: "",
				},
				groups: [
					"1",
				],
				id: "1",
				name: "test-proj-21",
				createdAt: "2023-04-19T14:06:42.186311Z",
				updatedAt: "2023-04-19T14:26:26.142592Z",
			},
			{
				tags: {
				},
				groups: [
				],
				id: "2",
				name: "test-proj-2",
				createdAt: "2023-04-19T14:15:15.250732Z",
				updatedAt: "2023-04-19T14:15:15.250732Z",
			},
		];
	}

	async getBranches(): Promise<string[] | undefined> {
		return ["main"];
	}

	async getScans(): Promise<CxScan[] | undefined> {
		return [{
			tags: {
			},
			groups: undefined,
			id: "1",
			projectID: "test-proj-21",
			status: "Completed",
			createdAt: "2023-04-19T15:10:38.749899+01:00",
			updatedAt: "2023-04-19T14:11:42.892326Z",
			origin: "grpc-java-netty 1.35.0",
			initiator: "tester",
			branch: "main",
		},
		{
			tags: {
			},
			groups: undefined,
			id: "2",
			projectID: "1",
			status: "Completed",
			createdAt: "2023-03-19T15:10:38.749899+01:00",
			updatedAt: "2023-03-19T14:11:42.892326Z",
			origin: "grpc-java-netty 1.35.0",
			initiator: "tester",
			branch: "main",
		}];
	}

	getBaseAstConfiguration() {
		const config = new CxConfig();
		config.additionalParameters = vscode.workspace.getConfiguration("checkmarxOne").get("additionalParams") as string;

		return config;
	}


	getAstConfiguration() {
		const token = vscode.workspace.getConfiguration("checkmarxOne").get("apiKey") as string;
		if (!token) {
			return undefined;
		}

		const config = this.getBaseAstConfiguration();
		config.apiKey = token;
		return config;
	}

	async isScanEnabled(): Promise<boolean> {
		return true;
	}
	async isAIGuidedRemediationEnabled(): Promise<boolean> {
		return true;
	}

	async isSCAScanEnabled(): Promise<boolean> {
		return true;
	}

	async triageShow() {
		return [];
	}

	async triageUpdate(): Promise<number> {
		return 0;
	}

	async getCodeBashing(): Promise<CxCodeBashing | undefined> {
		return {
			path: "https://codebashing.checkmarx.com/courses/java/lessons/sql_injection",
			cweId: "CWE-89",
			language: "Java",
			queryName: "SQL_Injection",
		};
	}

	async getResultsBfl() {
		return "";
	}

	async getResultsRealtime() {
		return undefined; // does not matter for testing purposes

	}

	async scaRemediation() {
		return 0;
	}

	async kicsRemediation() {
		return undefined; // does not matter for testing purposes
	}

	async learnMore() {
		return [{
			queryId: "5157925289005576664",
			queryName: "Reflected_XSS_All_Clients",
			queryDescriptionId: "Reflected_XSS_All_Clients",
			resultDescription: "The method @DestinationMethod embeds untrusted data in generated output with @DestinationElement, at line @DestinationLine of @DestinationFile. This untrusted data is embedded into the output without proper sanitization or encoding, enabling an attacker to inject malicious code into the generated web-page.\n\nThe attacker would be able to alter the returned web page by simply providing modified data in the user input @SourceElement, which is read by the @SourceMethod method at line @SourceLine of @SourceFile. This input then flows through the code straight to the output web page, without sanitization. \r\n\r\nThis can enable a Reflected Cross-Site Scripting (XSS) attack.\n\n",
			risk: "A successful XSS exploit would allow an attacker to rewrite web pages and insert malicious scripts which would alter the intended output. This could include HTML fragments, CSS styling rules, arbitrary JavaScript, or references to third party code. An attacker could use this to steal users' passwords, collect personal data such as credit card details, provide false information, or run malware. From the victim’s point of view, this is performed by the genuine website, and the victim would blame the site for incurred damage.\n\nThe attacker could use social engineering to cause the user to send the website modified input, which will be returned in the requested web page.\n\n",
			cause: "The application creates web pages that include untrusted data, whether from user input, the application’s database, or from other external sources. The untrusted data is embedded directly in the page's HTML, causing the browser to display it as part of the web page. If the input includes HTML fragments or JavaScript, these are displayed too, and the user cannot tell that this is not the intended page. The vulnerability is the result of directly embedding arbitrary data without first encoding it in a format that would prevent the browser from treating it like HTML or code instead of plain text.\n\nNote that an attacker can exploit this vulnerability either by modifying the URL, or by submitting malicious data in the user input or other request fields.\n\n",
			generalRecommendations: "*   Fully encode all dynamic data, regardless of source, before embedding it in output.\r\n*   Encoding should be context-sensitive. For example:\r\n    *   HTML encoding for HTML content\r\n    *   HTML Attribute encoding for data output to attribute values\r\n    *   JavaScript encoding for server-generated JavaScript\r\n*   It is recommended to use the platform-provided encoding functionality, or known security libraries for encoding output.\r\n*   Implement a Content Security Policy (CSP) with explicit whitelists for the application's resources only. \r\n*   As an extra layer of protection, validate all untrusted data, regardless of source (note this is not a replacement for encoding). Validation should be based on a whitelist: accept only data fitting a specified structure, rather than reject bad patterns. Check for:\r\n    *   Data type\r\n    *   Size\r\n    *   Range\r\n    *   Format\r\n    *   Expected values\r\n*   In the `Content-Type` HTTP response header, explicitly define character encoding (charset) for the entire page. \r\n*   Set the `HTTPOnly` flag on the session cookie for \"Defense in Depth\", to prevent any successful XSS exploits from stealing the cookie.\n*   Consider that many native PHP methods for sanitizing values, such as htmlspecialchars and htmlentities, do not inherently encode values for Javascript contexts and ignore certain enclosure characters such as apostrophe ('), quotes (\") and backticks (\\`). Always consider the output context of inputs before choosing either of these functions as sanitizers.",
			samples: [
				{
					progLanguage: "PHP",
					code: "if (isset($_GET['name'])) {\n    echo \"<h1>Welcome,\" . $_GET['name'] . \"!</h1>\";\n}",
					title: "Outputting Unsanitized Inputs into HTML Results in XSS",
				},
				{
					progLanguage: "PHP",
					code: "if (isset($_GET['name'])) {\n      //The payload \"name='; alert(1); //\" will result in XSS, as \"htmlspecialchars\" does not sanitize apostrophes\n    echo \"<script> var name = '\" . htmlspecialchars($_GET['name']) . \"';</script>\\r\\n\"; \n}",
					title: "Insecure Use of \"htmlspecialchars\" Without a Secure Flag\n",
				},
				{
					progLanguage: "PHP",
					code: "if (isset($_GET['name'])) {\n    //The payload \"name=`; alert(1); //\" will result in XSS, as \"htmlspecialchars\", even in this mode, does not sanitize backticks\n    //ENT_QUOTES flag encodes \"&<>'\n    echo \"<script> var name = `\" . htmlspecialchars($_GET['name'], ENT_QUOTES, 'UTF-8') . \"`;</script>\";\n}",
					title: "Insecure Use of \"htmlspecialchars\" With \"ENT_QUOTES\" Flag ",
				},
				{
					progLanguage: "PHP",
					code: "if (isset($_GET['name'])) {\n    //ENT_QUOTES flag sanitizes apostrophe\n    echo \"<script> var name = '\" . htmlspecialchars($_GET['name'], ENT_QUOTES, 'UTF-8') . \"';</script>\";\n}",
					title: "Secure Use of \"htmlspecialchars\" With \"ENT_QUOTES\" Flag",
				},
				{
					progLanguage: "PHP",
					code: "if (isset($_GET['name'])) {\n    //ENT_COMPAT flag encodes \"&<>\n    //The payload \"name='; alert(1); //\" will result in XSS, as \"htmlspecialchars\", even in this mode, does not sanitize apostrophe\n    echo \"<script> var name = '\" . htmlspecialchars($_GET['name'], ENT_COMPAT, 'UTF-8') . \"';</script>\";\n}\n",
					title: "Insecure Use of \"htmlspecialchars\" With \"ENT_COMPAT\" Flag",
				},
				{
					progLanguage: "PHP",
					code: "if (isset($_GET['name'])) {\n    //ENT_COMPAT flag sanitize quotation marks\n    echo \"<script> var name = \\\"\" . htmlspecialchars($_GET['name'], ENT_COMPAT, 'UTF-8') . \"\\\";</script>\";\n}",
					title: "Secure Use of \"htmlspecialchars\" With \"ENT_COMPAT\" Flag",
				},
			],
		}];
	}

	async runSastGpt() {
		await this.sleep(1000);
		return [{ conversationId: '0', response: ["Mock message response from gpt"] }];
	}

	async runGpt() {
		await this.sleep(1000);
		return [{ conversationId: '0', response: ["Mock message response from gpt"] }];
	}

	async mask() {
		await this.sleep(1000);
		return [{ conversationId: '0', response: ["Mock message response from gpt"] }];
	}
	
	sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	updateStatusBarItem(text: string, show: boolean, statusBarItem: vscode.StatusBarItem) {
		statusBarItem.text = text;
		show ? statusBarItem.show() : statusBarItem.hide();
	}

	installVorpal(): Promise<CxVorpal> {
		isInstallVorpal = true;
		return null;
	}

	async scanVorpal(sourcePath: string): Promise<CxVorpal> {
		scanVorpalNum ++;
		return new CxVorpal();
	}
}

