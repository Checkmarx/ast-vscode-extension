<img src="media/checkmarx_logo.png">
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
  <h3 align="center">VS Code Extension</h3>
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
    <li><a href="#key-features">Key Features</a></li>
    <li><a href="#prerequisites">Prerequisites</a></li>
    <li><a href="#initial-setup">Initial Setup</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

## Overview

Checkmarx continues to spearhead the shift-left approach to AppSec by bringing our powerful AppSec tools into your IDE. This empowers developers to identify vulnerabilities and remediate them **as they code**. 
The Checkmarx Visual Studio Code extension integrates seamlessly into your IDE, identifying vulnerabilities in your proprietary code, open source dependencies, and IaC files. The extension offers actionable remediation insights in real-time.

- **Checkmarx One** allows developers to access the full functionality of their Checkmarx One account directly from their IDE, eliminating the need for developers to use the CxOne platform. With this integration, you can initiate new scans, review scan results, and receive guided remediation advice. Checkmarx offers comprehensive details about each vulnerability, including remediation recommendations, examples of effective fixes, and AI-generated code suggestions. The extension also lets you quickly navigate from a vulnerability to the associated source code, making it easier to identify and address problematic areas.
  
This tool requires authentication, using credentials from your Checkmarx One account.

### Key Features

- **Remediation Advice**
  - Receive actionable results with remediation recommendations. Easily navigate from the results to the vulnerable code within the editor, allowing you to begin remediation immediately.
  - Access one-click Auto Remediation options for open-source risks.
  - Utilize the AI Security Champion feature for code remediation suggestions.
- **Pre-commit Scans**
  - Run a new scan directly from your IDE before committing your code, or import scan results from your Checkmarx One account.
- **Checkmarx Static Analysis Security Auto Scanning**  
  - Perform local scans every few seconds on supported language files.
  - Instantly scan code generated by Copilot.
  - Hover over lines of code to view remediation advice and apply Quick Fixes.
- **Local SCA Scanning**
  - Perform local scans looking for Open Source packages with known vulnerabilities 
- **Checkmarx IAC Security Auto Scanning**
  - A free tool that requires no Checkmarx account.
  - Scans your code automatically, running in the background whenever you open or save an IaC file.
  - Offers one-click Auto Remediation options.
- **Triage results**
  - Adjust the severity, update the state, and add comments directly from the VS Code extension.

## How To Videos
![](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_installation_and_initial_setup.gif)

![](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_running_scan.gif)

## Prerequisites
**IAC Security Auto Scanning:**
You must have Docker installed and running in your environment

**For Checkmarx One:**
You need to have a Checkmarx One account and an API key for your account. To create an API key, see [Generating an API Key](https://checkmarx.com/resource/documents/en/34965-118315-authentication-for-checkmarx-one-cli.html#UUID-a4e31a96-1f36-6293-e95a-97b4b9189060_UUID-1e7abdfa-77eb-2a6c-f12a-c812a1e1dcf7).

## Initial Setup
For **KICS Auto Scanning**, no configuration is needed, just install the extension, and start getting results!
For **Checkmarx One**, you need to configure your account info. See documentation [here](https://checkmarx.com/resource/documents/en/34965-123549-installing-and-setting-up-the-checkmarx-vs-code-extension.html).

Checkmarx One:
- You have a Checkmarx One account and can run Checkmarx One scans on your source code.
- You have an API key for your Checkmarx One account.

Kics Auto Scanning:
- You must have Docker installed and running in your environment (For KICS auto scanning only)

![](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_kics_auto_remediation.gif)

See our documentation for using [KICS Auto Scanning](https://checkmarx.com/resource/documents/en/34965-68744-using-the-checkmarx-vs-code-extension---kics-realtime-scanning.html) and [Checkmarx One](https://checkmarx.com/resource/documents/en/34965-68743-visual-studio-code---checkmarx-one--ast--results.html).


## Contributing

We appreciate feedback and contribution to the VsCode extension! Before you get started, please see the following:

- [Checkmarx contribution guidelines](docs/contributing.md)
- [Checkmarx Code of Conduct](docs/code_of_conduct.md)


<!-- LICENSE -->
## License

Distributed under the [Apache 2.0](LICENSE). See `LICENSE` for more information.

<!-- CONTACT -->
## Contact

Checkmarx - Integrations Team

Project Link: [https://github.com/Checkmarx/ast-vscode-extension](https://github.com/Checkmarx/ast-vscode-extension)

Find more integrations from our team [here](https://github.com/Checkmarx/ci-cd-integrations#checkmarx-ast-integrations)

© 2022 Checkmarx Ltd. All Rights Reserved.

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
