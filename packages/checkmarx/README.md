<img src="https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/PluginBanner.jpg">
<br />
<div align="center">

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![License][license-shield]][license-url]
[![Installs][installs-vscode-shield]][installs-vscode-url]

</div>

<br />
<p align="center">
  <a href="https://github.com/Checkmarx/ast-vscode-extension">
    <img src="https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/cx_x_icon.png" alt="Logo" width="80" height="80" />
  </a>
  <h3 align="center">Checkmarx VS Code Extension</h3>
  <h3 align="center">Also supported for: Cursor, Windsurf and Kiro</h3>  
  <p align="center">
    <a href="https://checkmarx.com/resource/documents/en/34965-68742-checkmarx-one-vs-code-extension--plugin-.html"><strong>Explore the docs »</strong></a>
    <br />
    <a href="https://marketplace.visualstudio.com/items?itemName=checkmarx.ast-results"><strong>Marketplace »</strong></a>
  </p>
</p>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#overview">Overview</a></li>
    <li><a href="#checkmarx-one-platform">Checkmarx One Platform</a></li>
    <li><a href="#checkmarx-developer-assist">Checkmarx Developer Assist</a></li>
    <li><a href="#kics-realtime-scanner">KICS Realtime Scanner</a></li>
    <li><a href="#checkmarx-sca-realtime-scanner">Checkmarx SCA Realtime Scanner</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#feedback">Feedback</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

## Overview
> ⭐ Although this plugin was developed for VS Code, the plugin has been tested and found to be effective for use in Cursor, Windsurf and Kiro. This document was written for the VS Code plugin, and applies equally to the other supported IDEs. Any information that applies **only** to VS Code, and not to the other supported IDEs, is noted explicitly.

Checkmarx continues to spearhead the shift-left approach to AppSec by bringing our powerful AppSec tools into your IDE. This empowers developers to identify vulnerabilities and remediate them **as they code**. The Checkmarx Visual Studio Code plugin integrates seamlessly into your IDE, identifying vulnerabilities in your proprietary code, open source dependencies, and IaC files. The plugin offers actionable remediation insights in real-time.

The Checkmarx Visual Studio Code extension contains four separate capabilities:

-   Checkmarx One Platform

-   Checkmarx Developer Assist

-   KICS Realtime Scanner

-   Checkmarx SCA Realtime Scanner

> The plugin is available on [marketplace](https://marketplace.visualstudio.com/items?itemName=checkmarx.ast-results). In addition, the code can be accessed [here](https://github.com/Checkmarx/ast-vscode-extension).

### Support for VS Code-compatible IDEs
Although this plugin was developed for VS Code, the plugin has been tested and found to be effective for use in the following VS Code-compatible IDEs:
- **Cursor**
- **Windsurf**
- **Kiro** (compatible with version 2.44.0 and above of this extension)


## Checkmarx One Platform

This tool enables Checkmarx One users to access the full functionality of your Checkmarx One account (SAST, SCA, IaC, and Secret Detection) directly from your IDE. You can run new scans or import results from scans run in your Checkmarx One account. Checkmarx provides detailed info about each vulnerability, including remediation recommendations and examples of effective remediation. The plugin enables you to navigate from a vulnerability to the relevant source code, so that you can easily zero-in on the problematic code and start working on remediation. <br>

These features require authentication, using an API Key or login credentials for your Checkmarx One account.


**GIF - Running a Scan from the IDE**
![Running a Scan from the IDE](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_running_scan.gif "Running a Scan from the IDE")

**GIF - Loading and Viewing Results**
![Loading and Viewing Results](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_loading_scan_results.gif "Loading and Viewing Results")

### Key Features

- Access the Checkmarx One platform directly from your IDE.
- Run a new scan from your IDE even before committing the code, or import scan results from your Checkmarx One account.
- Rescan an existing branch from your IDE or create a new branch in Checkmarx One for the local branch in your workspace.
- Provides actionable results including remediation recommendations. Navigate from the results panel directly to the highlighted vulnerable code in the editor and get right down to work on the remediation.
- Connect to Checkmarx via **API Key** or **OAuth user login** flow.
- View information about how to remediate **SAST vulnerabilities**, including code samples.
- Group and filter results.
- Triage results — edit the result predicate (severity, state, and comments) directly from the Visual Studio Code console (currently supported for **SAST**, **SCA** and **IaC Security**).
- Links to Codebashing lessons.
- Apply Auto Remediation to automatically remediate open source vulnerabilities by updating to a non-vulnerable package version.
- **“AI Security Champion”** harnesses the power of AI to help you understand the vulnerabilities in your code and resolve them quickly and easily (currently supported for **SAST** and **IaC Security** vulnerabilities).
- Shows [Application Security Posture Management (ASPM)](https://docs.checkmarx.com/en/34965-281716-application-security-posture-management.html) results in the IDE.

---

### Prerequisites

- An installation of a supported IDE. (**For VS Code**: VS Code version 1.63.0 or above)

- You have access to Checkmarx One via:
  - an **API Key** (see [*Generating an API Key*](https://docs.checkmarx.com/en/34965-68618-generating-an-api-key.html#UUID-f3b6481c-47f4-6cd8-9f0d-990896e36cd6_UUID-39ccc262-c7cb-5884-52ed-e1692a635e08)), OR
  - login credentials (**Base URL**, **Tenant name**, **Username**, and **Password**)

> 🔑 In order to use this integration for running an end-to-end flow of scanning a project and viewing results with the minimum required permissions, the API Key or user account should have the role `plugin-scanner`. Alternatively, they can have at a minimum the out-of-the-box composite role `ast-scanner` as well as the IAM role `default-roles`.

- **git** is installed on your local machine. For installation instructions, see [here](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git).

- To use **AI Generated Remediation**, you must have an **API Key for your GPT account**  
  (unless your account is configured to use Azure AI; see [*Configuring Plugin Settings*](https://docs.checkmarx.com/en/34965-324314-plugins-settings.html#UUID-ea5638d0-3673-520c-79e0-085f92d4a2dc_id_ConfiguringScannerDefaultSettings-OpenScannerDefaultSettings)).

### Installation

1. Install the **Checkmarx** extension from the Marketplace.
2. In the IDE, open Checkmarx One Settings, click on **Authentication**, and enter your  API Key or login credentials to enable all Checkmarx One features.
3. Configure additional Checkmarx One settings as described in Checkmarx [documentation](https://docs.checkmarx.com/en/34965-123549-installing-and-setting-up-the-checkmarx-vs-code-extension.html).

**GIF – Installing and Setting Up the Extension**  
![Installing and Setting up the Extension](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_installation_and_initial_setup.gif)

### Usage
* Learn about using Checkmarx One features [here](https://docs.checkmarx.com/en/34965-68743-using-the-checkmarx-vs-code-extension---checkmarx-one-results.html)

---

## Checkmarx Developer Assist
Developer Assist is an agentic AI tool that delivers real-time context-aware prevention, remediation, and guidance to developers inside the IDE. 
<br>
### Key Features
- An advanced security agent that delivers real-time context-aware prevention, remediation, and guidance to developers from the IDE.
- Realtime scanners identify risks as you code.
  - AI Secure Coding Assistant (ASCA), a lightweight source code scanner, enables developers to identify secure coding best practice violations in the file that they are working on as they code.
  - Specialized realtime scanners identify vulnerable open source packages and container images, as well as exposed secrets and IaC risks.
- MCP-based agentic AI remediation.
- AI powered explanation of risk details.
### Prerequisites
  - Either a **Developer Assist Access Key** OR 
  - Credentials for a Checkmarx One account with a **Checkmarx One Assist** license, and with the **Checkmarx MCP** activated for your tenant account in the Checkmarx One UI under **Settings → Plugins**. This must be done by an account admin.
  - **For VS Code**: Supported for VS Code version **1.100.0** or above  
    (supports both `settings.json` (v1.100–1.101) and `mcp.json` (v1.102+))
  - **For VS Code**: You must have **GitHub Copilot** installed
### Installation
1. Install the **Checkmarx** extension from the Marketplace.
2. In the IDE, open Checkmarx Settings, click on **Authentication**, and enter your  Access Key or login credentials.
3. Start the Checkmarx MCP server running.

**GIF - Getting Started With Developer Assist**
![Getting Started With Developer Assist](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/VS_Code_Getting_Started_with_Developer_Assist.gif)

### Usage
* Learn about using Checkmarx Developer Assist [here](https://docs.checkmarx.com/en/34965-474001-using-the-checkmarx-vs-code-extension---dev-assist.html)

**GIF - AI Remediation with Developer Assist**
![AI Remediation with Developer Assist](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/VS_Code_AI_Remediation_with_Developer_Assist_malicious_only.gif)

## KICS Realtime Scanner

This tool initiates KICS scans directly from their VS Code console. The scan runs automatically whenever an infrastructure file of a [supported type](https://docs.kics.io/latest/platforms/) is saved, either manually or by auto-save. The scan runs only on the file that is open in the editor. The results are shown in the VS Code console, making it easy to remediate the vulnerabilities that are detected. This is a **free tool** provided by Checkmarx for all VS Code users, and does not require the user to submit credentials for a Checkmarx One account.

**GIF - Automatic Remediation for KICS Vulnerabilities**
![Automatic Remediation for KICS Vulnerabilities](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_kics_auto_remediation.gif)

### Key Features

-   Free tool, no Checkmarx account required

-   Run scans directly from your IDE

-   Scans are triggered automatically whenever a file is saved

-   Apply Auto Remediation to automatically fix IaC vulnerabilities

-   "AI Guided Remediation” harnesses the power of AI to help you to understand the vulnerabilities in your code, and resolve them quickly and easily.

### Prerequisites

-   You must have a supported container engine (e.g., Docker, Podman etc.) installed and running in your environment.

-   In order to use **AI Generated Remediation**, you need to have an API Key for your GPT account.

### Installation

1. Install the **Checkmarx** extension from the Marketplace.
> No additional setup is required — KICS Realtime Scanner works automatically once the extension is installed.
2. If you would like to customize the scan parameters, enter the desired flags in the Additional Parameters field. For a list of available options, see [Scan Command Options](https://docs.checkmarx.com/en/34965-123549-installing-and-setting-up-the-checkmarx-vs-code-extension.html).

## Checkmarx SCA Realtime Scanner

This tool enables VS Code users to initiate SCA scans directly from their VS Code console, and shows detailed results as soon as the scan is completed. The scan identifies the open-source dependencies used in your code and indicates the security risks associated with those packages. The identified packages are shown in a tree structure with an indication of the risk level for each package. You can drill down to show the specific vulnerabilities associated with a package. This is a **free tool** provided by Checkmarx for all VS Code users, and does not require the user to submit credentials for a Checkmarx One account.

### Key Features

-   Free tool, no Checkmarx account required

-   Run scans directly from your IDE

-   View actionable results in your IDE, indicating which of your open-source packages are at risk

-   Provides links to detailed info about the vulnerabilities on the Checkmarx Developer Hub

### Prerequisites

-   In order to get comprehensive results, you need to install all relevant package managers on your local environment, see [Installing Supported Package Managers](https://checkmarx.com/resource/documents/en/34965-19198-installing-supported-package-managers-for-resolver.html).

### Installation

1. Install the **Checkmarx** extension from the Marketplace.
> No configuration is required for SCA Realtime Scanning in most environments.

## Contributing

We appreciate feedback and contribution to the VsCode extension! Before you get started, please see the following:

- [Checkmarx contribution guidelines](https://github.com/Checkmarx/ast-vscode-extension/blob/HEAD/packages/checkmarx/contributing.md)
- [Checkmarx Code of Conduct](https://github.com/Checkmarx/ast-vscode-extension/blob/HEAD/packages/checkmarx/code_of_conduct.md)

<!-- LICENSE -->
## License

Distributed under the [Apache 2.0](https://github.com/Checkmarx/ast-vscode-extension/blob/HEAD/LICENSE). See `LICENSE` for more information.

<!-- FEEDBACK -->
## Feedback
We’d love to hear your feedback! If you come across a bug or have a feature request, please let us know by submitting an issue in [GitHub Issues](https://github.com/Checkmarx/ast-vscode-extension/issues).

<!-- CONTACT -->
## Contact

Checkmarx - Integrations Team

Project Link: [https://github.com/Checkmarx/ast-vscode-extension](https://github.com/Checkmarx/ast-vscode-extension)

Find more integrations from our team [here](https://github.com/Checkmarx/ci-cd-integrations#checkmarx-ast-integrations)

© 2025 Checkmarx Ltd. All Rights Reserved.

[contributors-shield]: https://img.shields.io/github/contributors/Checkmarx/ast-vscode-extension.svg
[contributors-url]: https://github.com/Checkmarx/ast-vscode-extension/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/Checkmarx/ast-vscode-extension.svg
[forks-url]: https://github.com/Checkmarx/ast-vscode-extension/network/members
[stars-shield]: https://img.shields.io/github/stars/Checkmarx/ast-vscode-extension.svg
[stars-url]: https://github.com/Checkmarx/ast-vscode-extension/stargazers
[issues-shield]: https://img.shields.io/github/issues/Checkmarx/ast-vscode-extension.svg
[issues-url]: https://github.com/Checkmarx/ast-vscode-extension/issues
[license-shield]: https://img.shields.io/github/license/Checkmarx/ast-vscode-extension.svg
[license-url]: https://github.com/Checkmarx/ast-vscode-extension/blob/master/LICENSE
[installs-vscode-url]: https://marketplace.visualstudio.com/items?itemName=checkmarx.ast-results
[installs-vscode-shield]: https://img.shields.io/visual-studio-marketplace/i/checkmarx.ast-results