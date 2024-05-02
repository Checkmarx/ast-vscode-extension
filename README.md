<img src="https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/banner.png">
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
    <img src="https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/logo.png" alt="Logo" width="80" height="80" />
  </a>

  <h3 align="center">VSCODE PLUGIN</h3>

  <p align="center">
    <a href="https://checkmarx.com/resource/documents/en/34965-68742-checkmarx-one-vs-code-extension--plugin-.html"><strong>Explore the docs »</strong></a>
    <br />
    <a href="https://marketplace.visualstudio.com/items?itemName=checkmarx.ast-results"><strong>Marketplace »</strong></a>
  </p>
</p>



<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#overview">Overview</a>
    </li>
    <li>
      <a href="#key-features">Key Features</a>
    </li>
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
The Checkmarx Visual Studio Code plugin integrates seamlessly into your IDE, identifying vulnerabilities in your proprietary code, open source dependencies, and IaC files. The plugin offers actionable remediation insights in real-time.

This extension comprises two separate tools:
- **Checkmarx KICS Auto Scanning** is a free tool for identifying vulnerabilities in your IaC files (of [supported types](https://docs.kics.io/latest/platforms/)). Just install the extension and Checkmarx automatically starts identifying IaC vulnerabilities in your project and providing remediation recommendations. [KICS Auto Scanning](https://www.youtube.com/watch?v=sFD-9CQXfs0)

![](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_kics_auto_remediation.gif)



- **Checkmarx One** enables Checkmarx One users to access the full functionality of your Checkmarx One account (SAST, SCA, IaC) directly from your IDE. You can run new scans or import results from scans run in your Checkmarx One account. Checkmarx provides detailed info about each vulnerability, including remediation recommendations and examples of effective remediation. The plugin enables you to navigate from a vulnerability to the relevant source code, so that you can easily zero-in on the problematic code and start working on remediation. 
This tool requires authentication, using credentials from your Checkmarx One account.

![](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_installation_and_initial_setup.gif)

![](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_running_scan.gif)


### Key Features
- **Checkmarx KICS Auto Scanning**
  - Free tool, no Checkmarx account required.
  - Scan as you code, with new a new scan running in the background whenever you save an IaC file.
  - Recommendations for one-click Auto Remediation actions.
- **Checkmarx One**
  - Access the full power of Checkmarx One (SAST, SCA, and KICS) directly from your IDE.
  - Run a new scan from your IDE even before committing the code, or import scan results from your Checkmarx One account.
  - Provides actionable results including remediation recommendations. Navigate from results directly to the vulnerable code in the editor and get right down to work on the remediation.
  - Recommendations for one-click Auto Remediation actions for open-source risks.
  - Triage results (by adjusting the severity and state and adding comments) directly from the VS Code console.

## Prerequisites
**KICS Auto Scanning:**
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