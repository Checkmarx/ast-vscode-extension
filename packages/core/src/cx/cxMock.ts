import * as vscode from "vscode";
import CxScaRealtime from "@checkmarx/ast-cli-javascript-wrapper/dist/main/scaRealtime/CxScaRealTime";
import CxScan from "@checkmarx/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxProject from "@checkmarx/ast-cli-javascript-wrapper/dist/main/project/CxProject";
import CxCodeBashing from "@checkmarx/ast-cli-javascript-wrapper/dist/main/codebashing/CxCodeBashing";
import { CxConfig } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/wrapper/CxConfig";
import { getFilePath } from "../utils/utils";
import { writeFileSync } from "fs";
import { CxPlatform } from "./cxPlatform";
import CxAsca from "@checkmarx/ast-cli-javascript-wrapper/dist/main/asca/CxAsca";
import { constants } from "../utils/common/constants";
import { CxCommandOutput } from "@checkmarx/ast-cli-javascript-wrapper/dist/main/wrapper/CxCommandOutput";
import CxOssResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/oss/CxOss";
import CxSecretsResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/secrets/CxSecrets";
import CxIacResult from "@checkmarx/ast-cli-javascript-wrapper/dist/main/iacRealtime/CxIac";

export class CxMock implements CxPlatform {
  private context: vscode.ExtensionContext;

  constructor(context?: vscode.ExtensionContext) {
    this.context = context;
  }

  async iacScanResults(sourcePath: string, dockerProvider: string, ignoredFilePath?: string): Promise<CxIacResult[] | undefined> {
    return [new CxIacResult()];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async scaScanCreate(): Promise<CxScaRealtime[] | any> {
    return [
      {
        type: "Regular",
        scaType: "vulnerability",
        label: "sca",
        severity: "HIGH",
        description:
          "decode-uri-component is vulnerable to Improper Input Validation resulting in DoS.",
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
        comments: {},
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
      },
    ];
  }

  async scanCreate() {
    return {
      tags: {},
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

    if (scanId === "2" || scanId === constants.emptyResultsScanId) {
      results = {
        results: [],
      };
    } else {
      results = {
        results: [
          {
            type: "kics",
            label: "IaC Security",
            id: "150256",
            similarityId:
              "92742543fa8505b3ba24ff54894c94594d0d9e3873b05fb38dbcbdef40aa3062",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "LOW",
            created: "2022-09-02T10:45:29Z",
            firstFoundAt: "2022-08-26T10:28:36Z",
            foundAt: "2022-09-02T10:45:29Z",
            firstScanId: "cb834dcd-aaec-4e1f-a099-089d5fbe503e",
            description:
              "Ensure that HEALTHCHECK is being used. The HEALTHCHECK instruction tells Docker how to test a container to check that it is still working",
            descriptionHTML:
              "\u003cp\u003eEnsure that HEALTHCHECK is being used. The HEALTHCHECK instruction tells Docker how to test a container to check that it is still working\u003c/p\u003e\n",
            data: {
              queryId:
                "b03a748a-542d-44f4-bb86-9199ab4fd2d5 [Taken from query_id]",
              queryName: "Healthcheck Instruction Missing",
              group: "Insecure Configurations [Taken from category]",
              line: 3,
              platform: "Dockerfile",
              issueType: "MissingAttribute",
              expectedValue: "Dockerfile contains instruction 'HEALTHCHECK'",
              value: "Dockerfile doesn't contain instruction 'HEALTHCHECK'",
              filename: "/Dockerfile",
            },
            comments: {},
            vulnerabilityDetails: {
              cvss: {},
            },
          },
          {
            type: "kics",
            label: "IaC Security",
            id: "150255",
            similarityId:
              "bca11aa6fe8840e47585aaa38048073afc521dc953151be020fb8fc4cc38f54a",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "MEDIUM",
            created: "2022-09-02T10:45:29Z",
            firstFoundAt: "2022-08-26T10:28:36Z",
            foundAt: "2022-09-02T10:45:29Z",
            firstScanId: "cb834dcd-aaec-4e1f-a099-089d5fbe503e",
            description:
              "Package version pinning reduces the range of versions that can be installed, reducing the chances of failure due to unanticipated changes",
            descriptionHTML:
              "\u003cp\u003ePackage version pinning reduces the range of versions that can be installed, reducing the chances of failure due to unanticipated changes\u003c/p\u003e\n",
            data: {
              queryId:
                "d3499f6d-1651-41bb-a9a7-de925fea487b [Taken from query_id]",
              queryName: "Unpinned Package Version in Apk Add",
              group: "Supply-Chain [Taken from category]",
              line: 6,
              platform: "Dockerfile",
              issueType: "IncorrectValue",
              expectedValue:
                "RUN instruction with 'apk add \u003cpackage\u003e' should use package pinning form 'apk add \u003cpackage\u003e=\u003cversion\u003e'",
              value:
                "RUN instruction apk --no-cache add git python3 py-lxml     \u0026\u0026 rm -rf /var/cache/apk/* does not use package pinning form",
              filename: "/Dockerfile",
            },
            comments: {},
            vulnerabilityDetails: {
              cvss: {},
            },
          },
          {
            type: "sast",
            label: "sast",
            id: "255181",
            similarityId: "-1792929011",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "HIGH",
            created: "2022-09-02T10:45:54Z",
            firstFoundAt: "2022-08-26T10:28:57Z",
            foundAt: "2022-09-02T10:45:54Z",
            firstScanId: "cb834dcd-aaec-4e1f-a099-089d5fbe503e",
            description:
              "The method $PageLoad embeds untrusted data in generated output with echo, at line 11 of /insecure.php. This untrusted data is embedded into the output without proper sanitization or encoding, enabling an attacker to inject malicious code into the generated web-page.\n\nThe attacker would be able to alter the returned web page by simply providing modified data in the user input _POST, which is read by the $PageLoad method at line 10 of /insecure.php. This input then flows through the code straight to the output web page, without sanitization. \r\n\r\nThis can enable a Reflected Cross-Site Scripting (XSS) attack.\n\n",
            descriptionHTML:
              "\u003cp\u003eThe method $PageLoad embeds untrusted data in generated output with echo, at line 11 of /insecure.php. This untrusted data is embedded into the output without proper sanitization or encoding, enabling an attacker to inject malicious code into the generated web-page.\u003c/p\u003e\n\n\u003cp\u003eThe attacker would be able to alter the returned web page by simply providing modified data in the user input _POST, which is read by the $PageLoad method at line 10 of /insecure.php. This input then flows through the code straight to the output web page, without sanitization. \r\n\r\nThis can enable a Reflected Cross-Site Scripting (XSS) attack.\u003c/p\u003e\n",
            data: {
              // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
              queryId: 5157925289005576664,
              queryName: "Reflected_XSS_All_Clients",
              group: "PHP_High_Risk",
              resultHash: "ZGJRP6tLG66K4GwKarVTE8GDL/M=",
              languageName: "PHP",
              nodes: [
                {
                  id: "6BkcV9Pylb1Kk14z/xZHkWcP9hk=",
                  line: 10,
                  name: "_POST",
                  column: 8,
                  length: 6,
                  method: "$PageLoad",
                  nodeID: 164,
                  domType: "UnknownReference",
                  fileName: "/insecure.php",
                  fullName:
                    "$NS_insecure_a3ce4a23.$Cls_insecure_a3ce4a23._POST",
                  typeName: "CxDefaultObject",
                  methodLine: 1,
                  definitions: "1",
                },
                {
                  id: "o8XLDcRzoLEzVVdI3yyHchg/JH0=",
                  line: 10,
                  name: "var",
                  column: 1,
                  length: 4,
                  method: "$PageLoad",
                  nodeID: 168,
                  domType: "UnknownReference",
                  fileName: "/insecure.php",
                  fullName: "$NS_insecure_a3ce4a23.$Cls_insecure_a3ce4a23.var",
                  typeName: "CxDefaultObject",
                  methodLine: 1,
                  definitions: "1",
                },
                {
                  id: "yis1SnpLBtDSuxZBPhw76TaDjY4=",
                  line: 11,
                  name: "var",
                  column: 12,
                  length: 4,
                  method: "$PageLoad",
                  nodeID: 184,
                  domType: "UnknownReference",
                  fileName: "/insecure.php",
                  fullName: "$NS_insecure_a3ce4a23.$Cls_insecure_a3ce4a23.var",
                  typeName: "CxDefaultObject",
                  methodLine: 1,
                  definitions: "1",
                },
                {
                  id: "kZuPO2VpUX+yVNtYvSP3FVHVJBQ=",
                  line: 11,
                  name: "$_DoubleQuotedString",
                  column: 0,
                  length: 20,
                  method: "$PageLoad",
                  nodeID: 177,
                  domType: "MethodInvokeExpr",
                  fileName: "/insecure.php",
                  fullName: "$_DoubleQuotedString",
                  typeName: "$_DoubleQuotedString",
                  methodLine: 1,
                  definitions: "0",
                },
                {
                  id: "fO7BgAMUgzMTXcmTFe9v8TGpYPg=",
                  line: 11,
                  name: "echo",
                  column: 1,
                  length: 4,
                  method: "$PageLoad",
                  nodeID: 171,
                  domType: "MethodInvokeExpr",
                  fileName: "/insecure.php",
                  fullName: "echo",
                  typeName: "echo",
                  methodLine: 1,
                  definitions: "0",
                },
              ],
            },
            comments: {},
            vulnerabilityDetails: {
              cweId: 79,
              cvss: {},
              compliances: [
                "PCI DSS v3.2.1",
                "ASD STIG 4.10",
                "FISMA 2014",
                "NIST SP 800-53",
                "OWASP Top 10 2013",
                "OWASP Top 10 2017",
                "OWASP Top 10 2021",
              ],
            },
          },
          {
            type: "sast",
            label: "sast",
            id: "255181",
            similarityId: "-1792929011",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "CRITICAL",
            created: "2022-09-02T10:45:54Z",
            firstFoundAt: "2022-08-26T10:28:57Z",
            foundAt: "2022-09-02T10:45:54Z",
            firstScanId: "cb834dcd-aaec-4e1f-a099-089d5fbe503e",
            description:
              "The method $PageLoad embeds untrusted data in generated output with echo, at line 11 of /insecure.php. This untrusted data is embedded into the output without proper sanitization or encoding, enabling an attacker to inject malicious code into the generated web-page.\n\nThe attacker would be able to alter the returned web page by simply providing modified data in the user input _POST, which is read by the $PageLoad method at line 10 of /insecure.php. This input then flows through the code straight to the output web page, without sanitization. \r\n\r\nThis can enable a Reflected Cross-Site Scripting (XSS) attack.\n\n",
            descriptionHTML:
              "\u003cp\u003eThe method $PageLoad embeds untrusted data in generated output with echo, at line 11 of /insecure.php. This untrusted data is embedded into the output without proper sanitization or encoding, enabling an attacker to inject malicious code into the generated web-page.\u003c/p\u003e\n\n\u003cp\u003eThe attacker would be able to alter the returned web page by simply providing modified data in the user input _POST, which is read by the $PageLoad method at line 10 of /insecure.php. This input then flows through the code straight to the output web page, without sanitization. \r\n\r\nThis can enable a Reflected Cross-Site Scripting (XSS) attack.\u003c/p\u003e\n",
            data: {
              // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
              queryId: 5157925289005576664,
              queryName: "Reflected_XSS_All_Clients",
              group: "PHP_High_Risk",
              resultHash: "ZGJRP6tLG66K4GwKarVTE8GDL/M=",
              languageName: "PHP",
              nodes: [
                {
                  id: "6BkcV9Pylb1Kk14z/xZHkWcP9hk=",
                  line: 10,
                  name: "_POST",
                  column: 8,
                  length: 6,
                  method: "$PageLoad",
                  nodeID: 164,
                  domType: "UnknownReference",
                  fileName: "/insecure.php",
                  fullName:
                    "$NS_insecure_a3ce4a23.$Cls_insecure_a3ce4a23._POST",
                  typeName: "CxDefaultObject",
                  methodLine: 1,
                  definitions: "1",
                },
                {
                  id: "o8XLDcRzoLEzVVdI3yyHchg/JH0=",
                  line: 10,
                  name: "var",
                  column: 1,
                  length: 4,
                  method: "$PageLoad",
                  nodeID: 168,
                  domType: "UnknownReference",
                  fileName: "/insecure.php",
                  fullName: "$NS_insecure_a3ce4a23.$Cls_insecure_a3ce4a23.var",
                  typeName: "CxDefaultObject",
                  methodLine: 1,
                  definitions: "1",
                },
                {
                  id: "yis1SnpLBtDSuxZBPhw76TaDjY4=",
                  line: 11,
                  name: "var",
                  column: 12,
                  length: 4,
                  method: "$PageLoad",
                  nodeID: 184,
                  domType: "UnknownReference",
                  fileName: "/insecure.php",
                  fullName: "$NS_insecure_a3ce4a23.$Cls_insecure_a3ce4a23.var",
                  typeName: "CxDefaultObject",
                  methodLine: 1,
                  definitions: "1",
                },
                {
                  id: "kZuPO2VpUX+yVNtYvSP3FVHVJBQ=",
                  line: 11,
                  name: "$_DoubleQuotedString",
                  column: 0,
                  length: 20,
                  method: "$PageLoad",
                  nodeID: 177,
                  domType: "MethodInvokeExpr",
                  fileName: "/insecure.php",
                  fullName: "$_DoubleQuotedString",
                  typeName: "$_DoubleQuotedString",
                  methodLine: 1,
                  definitions: "0",
                },
                {
                  id: "fO7BgAMUgzMTXcmTFe9v8TGpYPg=",
                  line: 11,
                  name: "echo",
                  column: 1,
                  length: 4,
                  method: "$PageLoad",
                  nodeID: 171,
                  domType: "MethodInvokeExpr",
                  fileName: "/insecure.php",
                  fullName: "echo",
                  typeName: "echo",
                  methodLine: 1,
                  definitions: "0",
                },
              ],
            },
            comments: {},
            vulnerabilityDetails: {
              cweId: 79,
              cvss: {},
              compliances: [
                "PCI DSS v3.2.1",
                "ASD STIG 4.10",
                "FISMA 2014",
                "NIST SP 800-53",
                "OWASP Top 10 2013",
                "OWASP Top 10 2017",
                "OWASP Top 10 2021",
              ],
            },
          },
          {
            type: "sca",
            scaType: "Vulnerability",
            label: "sca",
            id: "cve-2011-3374",
            similarityId: "cve-2011-3374",
            status: "RECURRENT",
            state: "TO_VERIFY",
            severity: "LOW",
            created: "2023-04-21T10:34:40Z",
            firstFoundAt: "2023-02-23T12:19:31Z",
            foundAt: "2023-04-21T10:34:40Z",
            firstScanId: "eaa0f3ea-ce32-4059-9836-db13d16fb2c8",
            description:
              "It was found that apt-key in apt, all versions, do not correctly validate gpg keys with the master keyring, leading to a potential man-in-the-middle attack.",
            descriptionHTML:
              "\u003cp\u003eIt was found that apt-key in apt, all versions, do not correctly validate gpg keys with the master keyring, leading to a potential man-in-the-middle attack.\u003c/p\u003e\n",
            data: {},
            comments: {},
            vulnerabilityDetails: {
              cweId: "CWE-347",
              cvssScore: 3.7,
              cvss: {
                version: 3,
                attackVector: "NETWORK",
                availability: "NONE",
                confidentiality: "NONE",
                attackComplexity: "HIGH",
              },
            },
          },
          {
            type: "sscs-secret-detection",
            id: "49zX0DLkU5pXNroqUZ8IM57sO5U=",
            similarityId:
              "7dd5481569c41f10fa3eff060673446480940fbc853b960b5b240029088ce639",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "HIGH",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description: "jwt has detected secret for file /secrets.go.",
            data: {
              ruleId: "jwt",
              ruleName: "Jwt",
              fileName: "/secrets.go",
              line: 12,
              snippet: "eyJh***",
              slsaStep: "Source",
              ruleDescription:
                "Uncovered a JSON Web Token, which may lead to unauthorized access to web applications and sensitive user data.",
              remediation: "Remove secret",
              remediationLink: null,
              remediationAdditional:
                "Remove or mask the secret value shown in your file/artifact. If your secret is still valid, you should revoke it, in order to prevent malicious use of compromised secrets.",
              validity: "Unknown",
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-scorecard",
            id: "/5o5sN0v5K2I8J934plrSE6A8RQ=",
            similarityId:
              "c7b19748c8985c3717885512828eb8b43962af069a71543fd7354c12f291dadc",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "HIGH",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description:
              "score is 0: no update tool detected:\nWarn: tool 'RenovateBot' is not used\nWarn: tool 'Dependabot' is not used\nWarn: tool 'PyUp' is not used",
            data: {
              ruleId: "DependencyUpdateToolID",
              ruleName: "Dependency-Update-Tool",
              fileName: "Issue Found in your GitHub repository",
              line: 1,
              snippet: null,
              slsaStep: "Dependencies",
              ruleDescription:
                "Determines if the project uses a dependency update tool.",
              remediation:
                "Implement the remediation recommendations provided in the URL",
              remediationLink:
                "https://github.com/ossf/scorecard/blob/main/docs/checks.md#dependency-update-tool",
              remediationAdditional: null,
              validity: null,
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-scorecard",
            id: "A1hsrnELDUxAcOtjBGsP6GtlEBA=",
            similarityId:
              "023c7542148f63613c00f016af227e6aa5e8c617d7ca53e7522feaf91539249f",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "HIGH",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description:
              "score is 0: 1 commit(s) and 0 issue activity found in the last 90 days -- score normalized to 0",
            data: {
              ruleId: "MaintainedID",
              ruleName: "Maintained",
              fileName: "Issue Found in your GitHub repository",
              line: 1,
              snippet: null,
              slsaStep: "Source",
              ruleDescription:
                'Determines if the project is "actively maintained".',
              remediation:
                "Implement the remediation recommendations provided in the URL",
              remediationLink:
                "https://github.com/ossf/scorecard/blob/main/docs/checks.md#maintained",
              remediationAdditional: null,
              validity: null,
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-secret-detection",
            id: "AtXoUC0MXjbfw9pmPtR8LbsdvXk=",
            similarityId:
              "4a6ddb4a8d5a9cbcbc8b4c45d35e710bd753b1cb824e594fc0c44831273fa53e",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "HIGH",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description:
              "stripe-access-token has detected secret for file /secrets.go.",
            data: {
              ruleId: "stripe-access-token",
              ruleName: "Stripe-Access-Token",
              fileName: "/secrets.go",
              line: 6,
              snippet: "sk_t***",
              slsaStep: "Source",
              ruleDescription:
                "Found a Stripe Access Token, posing a risk to payment processing services and sensitive financial data.",
              remediation: "Remove secret",
              remediationLink: null,
              remediationAdditional:
                "Remove or mask the secret value shown in your file/artifact. If your secret is still valid, you should revoke it, in order to prevent malicious use of compromised secrets.",
              validity: "Unknown",
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-scorecard",
            id: "hJTinqcw2jva0HvKrXSM1hU3cgk=",
            similarityId:
              "23fa634d6ae404d07586c36f4bb7eee8682805ed003e514354f89408eb0d840d",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "LOW",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description:
              "score is 0: no effort to earn an OpenSSF best practices badge detected",
            data: {
              ruleId: "CIIBestPracticesID",
              ruleName: "CII-Best-Practices",
              fileName: "Issue Found in your GitHub repository",
              line: 1,
              snippet: null,
              slsaStep: "Source",
              ruleDescription:
                "Determines if the project has an OpenSSF (formerly CII) Best Practices Badge.",
              remediation:
                "Implement the remediation recommendations provided in the URL",
              remediationLink:
                "https://github.com/ossf/scorecard/blob/main/docs/checks.md#cii-best-practices",
              remediationAdditional: null,
              validity: null,
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-scorecard",
            id: "hzIL93W8mGkglJVJvtU5LWPFWCs=",
            similarityId:
              "ff67df300cd3e181ce0d5c11534f17b05d1634427c0974737645fe6140546b7b",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "HIGH",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description:
              "score is 0: branch protection not enabled on development/release branches:\nWarn: branch protection not enabled for branch 'main'",
            data: {
              ruleId: "BranchProtectionID",
              ruleName: "Branch-Protection",
              fileName: "Issue Found in your GitHub repository",
              line: 1,
              snippet: null,
              slsaStep: "Source",
              ruleDescription:
                "Determines if the default and release branches are protected with GitHub's branch protection settings.",
              remediation:
                "Implement the remediation recommendations provided in the URL",
              remediationLink:
                "https://github.com/ossf/scorecard/blob/main/docs/checks.md#branch-protection",
              remediationAdditional: null,
              validity: null,
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-secret-detection",
            id: "JiP6l2/7A1eZy/IJw5xb0K773VY=",
            similarityId:
              "7dd5481569c41f10fa3eff060673446480940fbc853b960b5b240029088ce639",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "HIGH",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description: "jwt has detected secret for file /secrets.go.",
            data: {
              ruleId: "jwt",
              ruleName: "Jwt",
              fileName: "/secrets.go",
              line: 31,
              snippet: "eyJh***",
              slsaStep: "Source",
              ruleDescription:
                "Uncovered a JSON Web Token, which may lead to unauthorized access to web applications and sensitive user data.",
              remediation: "Remove secret",
              remediationLink: null,
              remediationAdditional:
                "Remove or mask the secret value shown in your file/artifact. If your secret is still valid, you should revoke it, in order to prevent malicious use of compromised secrets.",
              validity: "Unknown",
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-secret-detection",
            id: "jIQToNyflbBa1oNDxw9KL/tRsJA=",
            similarityId:
              "a28bc5175d1eea7caca193f7e419d331b063de90005eb0dee86caf5beaf5efef",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "HIGH",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description:
              "aws-access-token has detected secret for file /secrets.go.",
            data: {
              ruleId: "aws-access-token",
              ruleName: "Aws-Access-Token",
              fileName: "/secrets.go",
              line: 24,
              snippet: "AKIA***",
              slsaStep: "Source",
              ruleDescription:
                "Identified a pattern that may indicate AWS credentials, risking unauthorized cloud resource access and data breaches on AWS platforms.",
              remediation: "Remove secret",
              remediationLink: null,
              remediationAdditional:
                "Remove or mask the secret value shown in your file/artifact. If your secret is still valid, you should revoke it, in order to prevent malicious use of compromised secrets.",
              validity: "Unknown",
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-scorecard",
            id: "lPQHovRXLnCOS084YFJztmmOgUs=",
            similarityId:
              "6012016a4cf3c90eb32ccc1f002be3df48fd50c564a258b66b68d41102deabcf",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "MEDIUM",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description:
              "score is 0: security policy file not detected:\nWarn: no security policy file detected\nWarn: no security file to analyze\nWarn: no security file to analyze\nWarn: no security file to analyze",
            data: {
              ruleId: "SecurityPolicyID",
              ruleName: "Security-Policy",
              fileName: "Issue Found in your GitHub repository",
              line: 1,
              snippet: null,
              slsaStep: "Source",
              ruleDescription:
                "Determines if the project has published a security policy.",
              remediation:
                "Implement the remediation recommendations provided in the URL",
              remediationLink:
                "https://github.com/ossf/scorecard/blob/main/docs/checks.md#security-policy",
              remediationAdditional: null,
              validity: null,
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-scorecard",
            id: "NEz6oBIVFxHpCSKo5eXrva9Kk9A=",
            similarityId:
              "0475e70493b2eb38b92c8379ab51b0e7ca99732f0de79d09973931be8c439228",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "HIGH",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description:
              "score is 0: found 2 unreviewed changesets out of 2 -- score normalized to 0",
            data: {
              ruleId: "CodeReviewID",
              ruleName: "Code-Review",
              fileName: "Issue Found in your GitHub repository",
              line: 1,
              snippet: null,
              slsaStep: "Source",
              ruleDescription:
                "Determines if the project requires human code review before pull requests (aka merge requests) are merged.",
              remediation:
                "Implement the remediation recommendations provided in the URL",
              remediationLink:
                "https://github.com/ossf/scorecard/blob/main/docs/checks.md#code-review",
              remediationAdditional: null,
              validity: null,
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-secret-detection",
            id: "qKGhcZ6Jd5mm4KaMTvg7c5d/+ro=",
            similarityId:
              "a28bc5175d1eea7caca193f7e419d331b063de90005eb0dee86caf5beaf5efef",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "HIGH",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description:
              "aws-access-token has detected secret for file /secrets.go.",
            data: {
              ruleId: "aws-access-token",
              ruleName: "Aws-Access-Token",
              fileName: "/secrets.go",
              line: 9,
              snippet: "AKIA***",
              slsaStep: "Source",
              ruleDescription:
                "Identified a pattern that may indicate AWS credentials, risking unauthorized cloud resource access and data breaches on AWS platforms.",
              remediation: "Remove secret",
              remediationLink: null,
              remediationAdditional:
                "Remove or mask the secret value shown in your file/artifact. If your secret is still valid, you should revoke it, in order to prevent malicious use of compromised secrets.",
              validity: "Unknown",
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-secret-detection",
            id: "TJWZcBouTD0JnYWO52XdEkQ2lpA=",
            similarityId:
              "4a6ddb4a8d5a9cbcbc8b4c45d35e710bd753b1cb824e594fc0c44831273fa53e",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "HIGH",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description:
              "stripe-access-token has detected secret for file /secrets.go.",
            data: {
              ruleId: "stripe-access-token",
              ruleName: "Stripe-Access-Token",
              fileName: "/secrets.go",
              line: 15,
              snippet: "sk_t***",
              slsaStep: "Source",
              ruleDescription:
                "Found a Stripe Access Token, posing a risk to payment processing services and sensitive financial data.",
              remediation: "Remove secret",
              remediationLink: null,
              remediationAdditional:
                "Remove or mask the secret value shown in your file/artifact. If your secret is still valid, you should revoke it, in order to prevent malicious use of compromised secrets.",
              validity: "Unknown",
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-scorecard",
            id: "tPes1zHT9L1Q5AP8T9iC5vZBG9U=",
            similarityId:
              "da8f116022d814a1d338444a27719a71e19cb3083bd6fe618649a00878ae8c25",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "MEDIUM",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description:
              "score is 0: project is not fuzzed:\nWarn: no OSSFuzz integration found\nWarn: no GoBuiltInFuzzer integration found\nWarn: no PythonAtherisFuzzer integration found\nWarn: no CLibFuzzer integration found\nWarn: no CppLibFuzzer integration found\nWarn: no SwiftLibFuzzer integration found\nWarn: no RustCargoFuzzer integration found\nWarn: no JavaJazzerFuzzer integration found\nWarn: no ClusterFuzzLite integration found\nWarn: no HaskellPropertyBasedTesting integration found\nWarn: no TypeScriptPropertyBasedTesting integration found\nWarn: no JavaScriptPropertyBasedTesting integration found",
            data: {
              ruleId: "FuzzingID",
              ruleName: "Fuzzing",
              fileName: "Issue Found in your GitHub repository",
              line: 1,
              snippet: null,
              slsaStep: "Package",
              ruleDescription: "Determines if the project uses fuzzing.",
              remediation:
                "Implement the remediation recommendations provided in the URL",
              remediationLink:
                "https://github.com/ossf/scorecard/blob/main/docs/checks.md#fuzzing",
              remediationAdditional: null,
              validity: null,
            },
            comments: {},
            vulnerabilityDetails: {},
          },
          {
            type: "sscs-secret-detection",
            id: "yfZPTrZsBH5X3BpleyRKUDS10BM=",
            similarityId:
              "0870b429f0107daadc62c70e36cbb47683a7605b38a76b32922e3e0ac6f85f85",
            status: "NEW",
            state: "TO_VERIFY",
            severity: "HIGH",
            confidenceLevel: 0,
            created: "2024-09-06T12:15:06Z",
            firstFoundAt: "2024-09-06T12:15:06Z",
            foundAt: "2024-09-06T12:15:06Z",
            firstScanId: "b57170dc-fb77-442b-a9b5-0f788654b8ee",
            description:
              "generic-api-key has detected secret for file /secrets.go.",
            data: {
              ruleId: "generic-api-key",
              ruleName: "Generic-Api-Key",
              fileName: "/secrets.go",
              line: 10,
              snippet: "abc1***",
              slsaStep: "Source",
              ruleDescription:
                "Detected a Generic API Key, potentially exposing access to various services and sensitive operations.",
              remediation: "Remove secret",
              remediationLink: null,
              remediationAdditional:
                "Remove or mask the secret value shown in your file/artifact. If your secret is still valid, you should revoke it, in order to prevent malicious use of compromised secrets.",
              validity: "Unknown",
            },
            comments: {},
            vulnerabilityDetails: {},
          },
        ],
      };
    }
    writeFileSync(
      getFilePath() + "/ast-results.json",
      JSON.stringify(results),
      {
        flag: "w+",
      }
    );
  }

  async getScan(scanId: string): Promise<CxScan | undefined> {
    if (scanId === constants.emptyResultsScanId) {
      return {
        tags: {},
        groups: undefined,
        id: constants.emptyResultsScanId,
        projectID: "EmptyResultsProjectId",
        status: "Completed",
        createdAt: "2023-03-19T15:10:38.749899+01:00",
        updatedAt: "2023-03-19T14:11:42.892326Z",
        origin: "grpc-java-netty 1.35.0",
        initiator: "tester",
        branch: "main",
      };
    }
    return {
      tags: {},
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
    if (projectId === "EmptyResultsProjectId") {
      return {
        tags: {},
        groups: [],
        id: "EmptyResultsProjectId",
        name: "EmptyResultsProjectName",
        createdAt: "2023-04-19T09:07:36.846145Z",
        updatedAt: "2023-04-19T09:07:36.846145Z",
      };
    }
    return {
      tags: {},
      groups: [],
      id: "1",
      name: "test-proj-21",
      createdAt: "2023-04-19T09:07:36.846145Z",
      updatedAt: "2023-04-19T09:07:36.846145Z",
    };
  }

  async getProjectListWithParams(
    params: string
  ): Promise<CxProject[] | undefined> {
    if (params) {
      if (this.getOffsetValue(params) === "0") {
        return [
          {
            tags: {
              integration: "",
            },
            groups: ["1"],
            id: "1",
            name: "test-proj-21",
            createdAt: "2023-04-19T14:06:42.186311Z",
            updatedAt: "2023-04-19T14:26:26.142592Z",
          },
          {
            tags: {},
            groups: [],
            id: "3",
            name: "test-proj-3",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "4",
            name: "test-proj-4",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "5",
            name: "test-proj-5",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "6",
            name: "test-proj-6",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "7",
            name: "test-proj-7",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "8",
            name: "test-proj-8",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "9",
            name: "test-proj-9",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "10",
            name: "test-proj-10",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "11",
            name: "test-proj-11",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "12",
            name: "test-proj-12",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "13",
            name: "test-proj-13",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "14",
            name: "test-proj-14",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "15",
            name: "test-proj-15",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "16",
            name: "test-proj-16",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "17",
            name: "test-proj-17",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "18",
            name: "test-proj-18",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "19",
            name: "test-proj-19",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "20",
            name: "test-proj-20",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "21",
            name: "test-proj-21",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
          {
            tags: {},
            groups: [],
            id: "22",
            name: "test-proj-22",
            createdAt: "2023-04-19T14:15:15.250732Z",
            updatedAt: "2023-04-19T14:15:15.250732Z",
          },
        ];
      }
      return [
        {
          tags: {},
          groups: [],
          id: "22",
          name: "test-proj-22",
          createdAt: "2023-04-19T14:15:15.250732Z",
          updatedAt: "2023-04-19T14:15:15.250732Z",
        },
        {
          tags: {},
          groups: [],
          id: "23",
          name: "test-proj-23",
          createdAt: "2023-04-19T14:15:15.250732Z",
          updatedAt: "2023-04-19T14:15:15.250732Z",
        },
        {
          tags: {},
          groups: [],
          id: "24",
          name: "test-proj-24",
          createdAt: "2023-04-19T14:15:15.250732Z",
          updatedAt: "2023-04-19T14:15:15.250732Z",
        },
      ];
    }
    return [
      {
        tags: {
          integration: "",
        },
        groups: ["1"],
        id: "1",
        name: "test-proj-21",
        createdAt: "2023-04-19T14:06:42.186311Z",
        updatedAt: "2023-04-19T14:26:26.142592Z",
      },
      {
        tags: {},
        groups: [],
        id: "2",
        name: "test-proj-2",
        createdAt: "2023-04-19T14:15:15.250732Z",
        updatedAt: "2023-04-19T14:15:15.250732Z",
      },
    ];
  }

  getOffsetValue(params: string) {
    const items = params.split(",");
    const offsetParam = items.find((param) => param.startsWith("offset="));
    return offsetParam ? offsetParam.split("=")[1] : null;
  }

  getBranchName(params: string) {
    return params.split(",")[0];
  }

  async getBranchesWithParams(
    projectId: string | undefined,
    params?: string | undefined
  ): Promise<string[] | undefined> {
    if (params) {
      if (this.getBranchName(params) === "main") {
        return ["main"];
      }
      if (this.getOffsetValue(params) === "0") {
        return [
          "main",
          "branch1",
          "branch2",
          "branch3",
          "branch4",
          "branch5",
          "branch6",
          "branch7",
          "branch8",
          "branch9",
          "branch10",
          "branch11",
          "branch12",
          "branch13",
          "branch14",
          "branch15",
          "branch16",
          "branch17",
          "branch18",
          "branch19",
          "branch20",
        ];
      }
      return [
        "branch21",
        "branch22",
        "branch23",
        "branch24",
        "branch25",
        "branch26",
      ];
    }
    return ["main"];
  }

  async getScans(
    projectId: string | undefined,
    branch: string | undefined
  ): Promise<CxScan[] | undefined> {
    if (branch === constants.localBranch) {
      return [];
    }
    return [
      {
        tags: {},
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
        tags: {},
        groups: undefined,
        id: "2",
        projectID: "1",
        status: "Completed",
        createdAt: "2023-03-19T15:10:38.749899+01:00",
        updatedAt: "2023-03-19T14:11:42.892326Z",
        origin: "grpc-java-netty 1.35.0",
        initiator: "tester",
        branch: "main",
      },
    ];
  }

  getBaseAstConfiguration() {
    const config = new CxConfig();
    config.additionalParameters = vscode.workspace
      .getConfiguration("checkmarxOne")
      .get("additionalParams") as string;

    return config;
  }

  async getAstConfiguration() {
    const token = await this.context.secrets.get(constants.getAuthCredentialSecretKey());

    if (!token) {
      return undefined;
    }

    const config = this.getBaseAstConfiguration();
    config.apiKey = token;
    return config;
  }

  async isValidConfiguration(): Promise<boolean> {
    return (await this.getAstConfiguration()) !== undefined;
  }

  async isScanEnabled(): Promise<boolean> {
    return true;
  }

  async isStandaloneEnabled(): Promise<boolean> {
    return false;
  }

  async isCxOneAssistEnabled(): Promise<boolean> {
    return false;
  }

  async isAIGuidedRemediationEnabled(): Promise<boolean> {
    return true;
  }


  async isAiMcpServerEnabled(): Promise<boolean> {
    return true;
  }

  async isSCAScanEnabled(): Promise<boolean> {
    return true;
  }

  async triageShow() {
    return [];
  }

  async triageSCAShow() {
    return [];
  }

  async triageUpdate(): Promise<number> {
    return 0;
  }

  async triageSCAUpdate(): Promise<number> {
    return 0;
  }

  async triageGetStates(): Promise<CxCommandOutput> {
    return {
      exitCode: 0,
      /* eslint-disable @typescript-eslint/no-explicit-any */
      payload: [] as any[],
      status: "",
    };
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
    return [
      {
        queryId: "5157925289005576664",
        queryName: "Reflected_XSS_All_Clients",
        queryDescriptionId: "Reflected_XSS_All_Clients",
        resultDescription:
          "The method @DestinationMethod embeds untrusted data in generated output with @DestinationElement, at line @DestinationLine of @DestinationFile. This untrusted data is embedded into the output without proper sanitization or encoding, enabling an attacker to inject malicious code into the generated web-page.\n\nThe attacker would be able to alter the returned web page by simply providing modified data in the user input @SourceElement, which is read by the @SourceMethod method at line @SourceLine of @SourceFile. This input then flows through the code straight to the output web page, without sanitization. \r\n\r\nThis can enable a Reflected Cross-Site Scripting (XSS) attack.\n\n",
        risk: "A successful XSS exploit would allow an attacker to rewrite web pages and insert malicious scripts which would alter the intended output. This could include HTML fragments, CSS styling rules, arbitrary JavaScript, or references to third party code. An attacker could use this to steal users' passwords, collect personal data such as credit card details, provide false information, or run malware. From the victim's point of view, this is performed by the genuine website, and the victim would blame the site for incurred damage.\n\nThe attacker could use social engineering to cause the user to send the website modified input, which will be returned in the requested web page.\n\n",
        cause:
          "The application creates web pages that include untrusted data, whether from user input, the application's database, or from other external sources. The untrusted data is embedded directly in the page's HTML, causing the browser to display it as part of the web page. If the input includes HTML fragments or JavaScript, these are displayed too, and the user cannot tell that this is not the intended page. The vulnerability is the result of directly embedding arbitrary data without first encoding it in a format that would prevent the browser from treating it like HTML or code instead of plain text.\n\nNote that an attacker can exploit this vulnerability either by modifying the URL, or by submitting malicious data in the user input or other request fields.\n\n",
        generalRecommendations:
          '*   Fully encode all dynamic data, regardless of source, before embedding it in output.\r\n*   Encoding should be context-sensitive. For example:\r\n    *   HTML encoding for HTML content\r\n    *   HTML Attribute encoding for data output to attribute values\r\n    *   JavaScript encoding for server-generated JavaScript\r\n*   It is recommended to use the platform-provided encoding functionality, or known security libraries for encoding output.\r\n*   Implement a Content Security Policy (CSP) with explicit whitelists for the application\'s resources only. \r\n*   As an extra layer of protection, validate all untrusted data, regardless of source (note this is not a replacement for encoding). Validation should be based on a whitelist: accept only data fitting a specified structure, rather than reject bad patterns. Check for:\r\n    *   Data type\r\n    *   Size\r\n    *   Range\r\n    *   Format\r\n    *   Expected values\r\n*   In the `Content-Type` HTTP response header, explicitly define character encoding (charset) for the entire page. \r\n*   Set the `HTTPOnly` flag on the session cookie for "Defense in Depth", to prevent any successful XSS exploits from stealing the cookie.\n*   Consider that many native PHP methods for sanitizing values, such as htmlspecialchars and htmlentities, do not inherently encode values for Javascript contexts and ignore certain enclosure characters such as apostrophe (\'), quotes (") and backticks (\\`). Always consider the output context of inputs before choosing either of these functions as sanitizers.',
        samples: [
          {
            progLanguage: "PHP",
            code: "if (isset($_GET['name'])) {\n    echo \"<h1>Welcome,\" . $_GET['name'] . \"!</h1>\";\n}",
            title: "Outputting Unsanitized Inputs into HTML Results in XSS",
          },
          {
            progLanguage: "PHP",
            code: 'if (isset($_GET[\'name\'])) {\n      //The payload "name=\'; alert(1); //" will result in XSS, as "htmlspecialchars" does not sanitize apostrophes\n    echo "<script> var name = \'" . htmlspecialchars($_GET[\'name\']) . "\';</script>\\r\\n"; \n}',
            title: 'Insecure Use of "htmlspecialchars" Without a Secure Flag\n',
          },
          {
            progLanguage: "PHP",
            code: 'if (isset($_GET[\'name\'])) {\n    //The payload "name=`; alert(1); //" will result in XSS, as "htmlspecialchars", even in this mode, does not sanitize backticks\n    //ENT_QUOTES flag encodes "&<>\'\n    echo "<script> var name = `" . htmlspecialchars($_GET[\'name\'], ENT_QUOTES, \'UTF-8\') . "`;</script>";\n}',
            title: 'Insecure Use of "htmlspecialchars" With "ENT_QUOTES" Flag ',
          },
          {
            progLanguage: "PHP",
            code: "if (isset($_GET['name'])) {\n    //ENT_QUOTES flag sanitizes apostrophe\n    echo \"<script> var name = '\" . htmlspecialchars($_GET['name'], ENT_QUOTES, 'UTF-8') . \"';</script>\";\n}",
            title: 'Secure Use of "htmlspecialchars" With "ENT_QUOTES" Flag',
          },
          {
            progLanguage: "PHP",
            code: "if (isset($_GET['name'])) {\n    //ENT_COMPAT flag encodes \"&<>\n    //The payload \"name='; alert(1); //\" will result in XSS, as \"htmlspecialchars\", even in this mode, does not sanitize apostrophe\n    echo \"<script> var name = '\" . htmlspecialchars($_GET['name'], ENT_COMPAT, 'UTF-8') . \"';</script>\";\n}\n",
            title: 'Insecure Use of "htmlspecialchars" With "ENT_COMPAT" Flag',
          },
          {
            progLanguage: "PHP",
            code: "if (isset($_GET['name'])) {\n    //ENT_COMPAT flag sanitize quotation marks\n    echo \"<script> var name = \\\"\" . htmlspecialchars($_GET['name'], ENT_COMPAT, 'UTF-8') . \"\\\";</script>\";\n}",
            title: 'Secure Use of "htmlspecialchars" With "ENT_COMPAT" Flag',
          },
        ],
      },
    ];
  }

  async runSastGpt() {
    await this.sleep(1000);
    return [
      { conversationId: "0", response: ["Mock message response from gpt"] },
    ];
  }

  async runGpt() {
    await this.sleep(1000);
    return [
      { conversationId: "0", response: ["Mock message response from gpt"] },
    ];
  }

  async mask() {
    await this.sleep(1000);
    return [
      { conversationId: "0", response: ["Mock message response from gpt"] },
    ];
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  updateStatusBarItem(
    text: string,
    show: boolean,
    statusBarItem: vscode.StatusBarItem
  ) {
    statusBarItem.text = text;
    show ? statusBarItem.show() : statusBarItem.hide();
  }

  installAsca(): Promise<CxAsca> {
    return null;
  }

  async scanAsca(sourcePath: string): Promise<CxAsca> {
    return new CxAsca();
  }

  async ossScanResults(sourcePath: string, ignoredFilePath?: string): Promise<CxOssResult[]> {
    return [];
  }


  async scanContainers(sourcePath: string, ignoredFilePath): Promise<any> {
    return {
      Images: [
        {
          imageName: "nginx",
          imageTag: "latest",
          filePath: sourcePath,
          locations: [
            {
              line: 1,
              startIndex: 0,
              endIndex: 20
            }
          ],
          status: "Malicious",
          vulnerabilities: [
            {
              CVE: "CVE-2023-12345",
              Severity: "High"
            },
            {
              CVE: "CVE-2023-67890",
              Severity: "Medium"
            }
          ]
        }
      ]
    };
  }

  async secretsScanResults(sourcePath: string, ignoredFilePath?: string): Promise<CxSecretsResult[]> {
    return [];
  }

  async authValidate(): Promise<boolean> {
    return true;
  }

  public getRiskManagementResults(
    projectId: string,
    scanId: string
  ): Promise<{
    projectID: string;
    scanID: string;
    applicationNameIDMap: any[];
    results: any[];
  }> {
    return Promise.resolve({
      projectID: "1",
      scanID: "1",
      applicationNameIDMap: [
        {
          applicationID: "7b0a17ce-f460-44d2-97d1-ada582119480",
          applicationName: "test1",
          score: 7,
        },
        {
          applicationID: "f559d5b9-9920-4256-8b9a-92224751b3a3",
          applicationName: "abcTest2",
          score: 7.3,
        },
        {
          applicationID: "5dff8d1c-d27f-4910-afc1-0b9df02324b4",
          applicationName: "Test3",
          score: 7.3,
        },
        {
          applicationID: "990c4252-b065-4d10-806a-3b86393c7ff3",
          applicationName: "zTest4",
          score: 7.4,
        },
        {
          applicationID: "9b73c468-56c7-4ac2-a6a4-890b8eb97f93",
          applicationName: "zTest5",
          score: 7.4,
        },
      ],
      results: [
        {
          id: "00e592de-0bc4-46da-8ce8-739b8fa91e34",
          name: "Cxadcc9e15-660b",
          hash: "V9nPpvBHoh1aF66qIFS/AZ/62YI5qZjLnNUSoapIlbk=",
          type: "directPackage",
          state: "new",
          engine: "sca",
          severity: "high",
          riskScore: 8.7,
          enrichmentSources: {},
          createdAt: "2025-04-01T09:38:29Z",
          applicationsScores: [
            {
              applicationID: "5dff8d1c-d27f-4910-afc1-0b9df02324b4",
              score: 4.4,
            },
            {
              applicationID: "7b0a17ce-f460-44d2-97d1-ada582119480",
              score: 3,
            },
            {
              applicationID: "990c4252-b065-4d10-806a-3b86393c7ff3",
              score: 4.2,
            },
            {
              applicationID: "9b73c468-56c7-4ac2-a6a4-890b8eb97f93",
              score: 8.5,
            },
            {
              applicationID: "f559d5b9-9920-4256-8b9a-92224751b3a3",
              score: 4.2,
            },
          ],
        },
        {
          id: "01e03512-d58b-4f9a-838f-18507d1acd3a",
          name: "Cx28bd7545-eb30",
          hash: "Llgxx8kRAGBRADIjVKlepWrlfVq4DWzFH/iy8+hfeRw=",
          type: "directPackage",
          state: "new",
          engine: "sca",
          severity: "high",
          riskScore: 8.7,
          enrichmentSources: {},
          createdAt: "2025-04-01T09:38:29Z",
          applicationsScores: [
            {
              applicationID: "5dff8d1c-d27f-4910-afc1-0b9df02324b4",
              score: 5.2,
            },
            {
              applicationID: "7b0a17ce-f460-44d2-97d1-ada582119480",
              score: 7.5,
            },
            {
              applicationID: "990c4252-b065-4d10-806a-3b86393c7ff3",
              score: 8.6,
            },
            {
              applicationID: "9b73c468-56c7-4ac2-a6a4-890b8eb97f93",
              score: 8,
            },
            {
              applicationID: "f559d5b9-9920-4256-8b9a-92224751b3a3",
              score: 7.6,
            },
          ],
        },
        {
          id: "0a293a7e-af26-4126-8e70-9a79d41043b4",
          name: "Cx9c42b5fe-7ada",
          hash: "IdkIDsf/5XU9p8pZI87bjSIfrhhXOVGIHh7jWWcl2/w=",
          type: "directPackage",
          state: "new",
          engine: "sca",
          severity: "high",
          riskScore: 8.7,
          enrichmentSources: {},
          createdAt: "2025-04-01T09:38:29Z",
          applicationsScores: [
            {
              applicationID: "5dff8d1c-d27f-4910-afc1-0b9df02324b4",
              score: 5.2,
            },
            {
              applicationID: "7b0a17ce-f460-44d2-97d1-ada582119480",
              score: 7,
            },
            {
              applicationID: "990c4252-b065-4d10-806a-3b86393c7ff3",
              score: 6.7,
            },
            {
              applicationID: "9b73c468-56c7-4ac2-a6a4-890b8eb97f93",
              score: 8.5,
            },
            {
              applicationID: "f559d5b9-9920-4256-8b9a-92224751b3a3",
              score: 4,
            },
          ],
        },
      ],
    });
  }

  setUserEventDataForLogs(): void {
  }

  setUserEventDataForDetectionLogs(): void {
  }
}
