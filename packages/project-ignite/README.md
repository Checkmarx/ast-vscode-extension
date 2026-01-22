<img src="https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/PluginBanner.jpg">
<br />
<div align="center">

[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![License][license-shield]][license-url]

</div>

<br />
<p align="center">
  <a href="https://github.com/Checkmarx/ast-vscode-extension">
    <img src="https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/cx_x_icon.png" alt="Logo" width="80" height="80" />
  </a>
  <h3 align="center">Checkmarx Developer Assist</h3>
  <h3 align="center">Also supported for: Cursor, Windsurf and Kiro</h3>
  <p align="center">
    <a href="https://checkmarx.com/resource/documents/en/34965-68742-checkmarx-one-vs-code-extension--plugin-.html"><strong>Explore the docs »</strong></a>
  </p>
</p>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#overview">Overview</a></li>
    <li><a href="#checkmarx-developer-assist">Checkmarx Developer Assist</a></li>
    <li><a href="#prerequisites">Prerequisites</a></li>
    <li><a href="#installation">Installation</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#feedback">Feedback</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

## Overview
> ⭐ Although this extension was developed for VS Code, it has been tested and found to be effective for use in Cursor, Windsurf and Kiro. This document was written for the VS Code extension, and applies equally to the other supported IDEs. Any information that applies **only** to VS Code, and not to the other supported IDEs, is noted explicitly.

Checkmarx Developer Assist brings powerful AI-driven security capabilities directly into your IDE, empowering developers to identify and remediate vulnerabilities **as they code**. This extension integrates seamlessly into your development workflow, providing real-time context-aware prevention, remediation, and guidance.

**Checkmarx Developer Assist** is an agentic AI tool that delivers intelligent security insights and automated remediation directly in your IDE, helping you write more secure code from the start.

> The code can be accessed [here](https://github.com/Checkmarx/ast-vscode-extension).

### Support for VS Code-compatible IDEs
Although this extension was developed for VS Code, it has been tested and found to be effective for use in the following VS Code-compatible IDEs:
- **Cursor**
- **Windsurf**
- **Kiro** (compatible with version 2.44.0 and above of this extension)

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
1. Install the **Checkmarx Developer Assist** extension from the Marketplace.
2. In the IDE, open Developer Assist Settings, click on **Authentication**, and enter your Access Key or login credentials.

### Usage
* Learn about using Checkmarx Developer Assist [here](https://docs.checkmarx.com/en/34965-474001-using-the-checkmarx-vs-code-extension---dev-assist.html)

**GIF - AI Remediation with Developer Assist**

## Contributing

We appreciate feedback and contribution to the VsCode extension! Before you get started, please see the following:

- [Checkmarx contribution guidelines](https://github.com/Checkmarx/ast-vscode-extension/blob/HEAD/docs/contributing.md)
- [Checkmarx Code of Conduct](https://github.com/Checkmarx/ast-vscode-extension/blob/HEAD/docs/code_of_conduct.md)

<!-- LICENSE -->
## License

Distributed under the [Apache 2.0](https://github.com/Checkmarx/ast-vscode-extension/blob/HEAD/LICENSE). See `LICENSE` for more information.

<!-- FEEDBACK -->
## Feedback
We'd love to hear your feedback! If you come across a bug or have a feature request, please let us know by submitting an issue in [GitHub Issues](https://github.com/Checkmarx/ast-vscode-extension/issues).

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
