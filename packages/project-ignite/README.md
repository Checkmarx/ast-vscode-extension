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
  <h3 align="center">Checkmarx Developer Assist</h3>
  <h4 align="center">VS Code Extension - runs also on Cursor, Windsurf and Kiro</h3>  
  <p align="center">
    <a href="https://docs.checkmarx.com/en/34965-405960-checkmarx-one-developer-assist.html"><strong>Explore the docs »</strong></a>
    <br />
    <a href="https://marketplace.visualstudio.com/items?itemName=checkmarx.cx-dev-assist"><strong>Marketplace »</strong></a>
  </p>
</p>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#overview">Overview</a></li>
    <li><a href="#prerequisites">Prerequisites</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#feedback">Feedback</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

> This document relates to the standalone ​**Checkmarx Developer Assist**​ extension. Checkmarx One customers with a Developer Assist license should use the ​[**Checkmarx**](https://marketplace.visualstudio.com/items?itemName=checkmarx.ast-results) extension, which has Developer Assist bundeled together with the Checkmarx One platform tool. <br>The two extensions are **mutually exclusive**, so that if you want to use this extension, you must **first ​uninstall**​​ the Checkmarx extension.
## Overview
Checkmarx Developer Assist delivers context-aware security guidance directly within your IDE, helping prevent vulnerabilities before they reach the pipeline. As developers write or refine AI-generated and existing code, it provides real-time detection, remediation, and actionable insights—ensuring security is built in from the start.
<br>
Checkmarx Developer Assist comprises two main elements:
- **​​Realtime Scanning** -​​ Identify vulnerabilities in realtime during IDE development of both human-generated and AI-generated code. Our super-fast scanners run in the background whenever you edit a relevant file. Our scanners identify vulnerabilities and unmasked secrets in your code. We also identify vulnerable or malicious container images and open source packages used in your project. 
* **​​Agentic-AI Remediation**​​ – Initiate an Agentic-AI session to receive remediation suggestions. Checkmarx feeds all relevant info to the AI agent which accesses our Model Context Protocol (MCP) server to gather data from our proprietary databases and customized AI models. The AI assistant then uses this data to generate remediated code for your project. You can accept the suggested changes or you can chat with the AI agent to learn more about the vulnerability and fine-tune the remediation suggestion.

### Support for VS Code-compatible IDEs
Although this plugin was developed for VS Code, the plugin has been tested and found to be effective for use in the following VS Code-compatible IDEs:
- **Cursor**
- **Windsurf**
- **Kiro** <br>

This document was written for the VS Code plugin, and applies equally to the other supported IDEs. Any information that applies only to VS Code, and not to the other supported IDEs, is noted explicitly.

### Key Features
- An advanced security agent that delivers real-time context-aware detection, remediation, and guidance to developers from the IDE.
- Realtime scanners identify risks as you code.
  - AI Secure Coding Assistant (ASCA), a lightweight source code scanner, enables developers to identify secure coding best practice violations in the file that they are working on as they code.
  - Specialized realtime scanners identify vulnerable open source packages and container images, as well as exposed secrets and IaC risks.
- MCP-based agentic AI remediation.
- AI powered explanation of risk details.
- Reduce noise by marking false positives as ignored
## Prerequisites
  - **Developer Assist API Key** 
  - **For VS Code**: Supported for VS Code version **1.100.0** or above  
    (supports both `settings.json` (v1.100–1.101) and `mcp.json` (v1.102+))
  - **For VS Code**: You must have **GitHub Copilot** installed
### Installation
1. Install the **Checkmarx Developer Assist** extension from the Marketplace.
2. In the IDE, open Checkmarx **Settings**, click on **Authentication**, and enter your access key in the **Developer Assist API Key** field.
3. Start running the Checkmarx MCP server.

**GIF - Getting Started With Developer Assist**
![Getting Started With Developer Assist](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/VS_Code_Getting_Started_with_Developer_Assist_standalone.gif)

### Usage
* Learn about using Checkmarx Developer Assist [here](https://docs.checkmarx.com/en/34965-405960-checkmarx-one-developer-assist.html)

**GIF - AI Remediation with Developer Assist**
![AI Remediation with Developer Assist](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/VS_Code_AI_Remediation_with_Developer_Assist_malicious_only.gif)


## Contributing

We appreciate feedback and contribution to the VsCode extension! Before you get started, please see the following:

- [Checkmarx contribution guidelines](https://github.com/Checkmarx/ast-vscode-extension/blob/HEAD/packages/project-ignite/contributing.md)
- [Checkmarx Code of Conduct](https://github.com/Checkmarx/ast-vscode-extension/blob/HEAD/packages/project-ignite/code_of_conduct.md)

<!-- LICENSE -->
## License

Distributed under the [Apache 2.0](https://github.com/CheckmarxDev/ast-vscode-extension/blob/HEAD/LICENSE). See `LICENSE` for more information.

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
