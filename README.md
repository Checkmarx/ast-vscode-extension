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
  <a href="https://github.com/Checkmarx/ast-vscode-extension">
    <img src="https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/xIcon.jpg" alt="Logo" width="80" height="80" />
  </a>
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
    <li><a href="#checkmarx-one-results">Checkmarx One Results</a></li>
    <li><a href="#kics-realtime-scanner">KICS Realtime Scanner</a></li>
    <li><a href="#checkmarx-sca-realtime-scanner">Checkmarx SCA Realtime Scanner</a></li>
    <li><a href="#initial-setup">Initial Setup</a></li>
    <li><a href="#feedback">Feedback</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>

## Overview

Checkmarx continues to spearhead the shift-left approach to AppSec by bringing our powerful AppSec tools into your IDE. This empowers developers to identify vulnerabilities and remediate them **as they code**. The Checkmarx Visual Studio Code plugin integrates seamlessly into your IDE, identifying vulnerabilities in your proprietary code, open source dependencies, and IaC files. The plugin offers actionable remediation insights in real-time.

The Checkmarx Visual Studio Code extension contains three separate tools:

-   Checkmarx One Results

-   KICS Realtime Scanner

-   Checkmarx SCA Realtime Scanner

> The plugin is available on [marketplace](https://marketplace.visualstudio.com/items?itemName=checkmarx.ast-results). In addition, the code can be accessed [here](https://github.com/CheckmarxDev/ast-vscode-extension).

## Checkmarx One Results

This tool enables Checkmarx One users to access the full functionality of your Checkmarx One account  directly from your IDE. You can run new scans or import results from scans run in your Checkmarx One account. Checkmarx provides detailed info about each vulnerability, including remediation recommendations and examples of effective remediation.

The extension enables you to navigate from a vulnerability to the relevant source code, so that you can easily zero-in on the problematic code and start working on remediation. This tool requires authentication, using credentials from your Checkmarx One account.


**GIF - Running a Scan from the IDE**
![Running a Scan from the IDE](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_running_scan.gif "Running a Scan from the IDE")

**GIF - Loading and Viewing Results**
![Loading and Viewing Results](https://checkmarx.com/resource/documents/en/image/164fe2f63cec51.gif "Loading and Viewing Results")

### Key Features

-   Access the full power of Checkmarx One (SAST, SCA, IaC Security and Secret Detection) directly from your IDE.

-   Run a new scan from your IDE even before committing the code, or import scan results from your Checkmarx One account.

- Rescan an existing branch from your IDE or create a new branch in Checkmarx One for the local branch in your workspace.

-   Provides actionable results including remediation recommendations. Navigate from results panel directly to the highlighted vulnerable code in the editor and get right down to work on the remediation.

-   View info about how to remediate SAST vulnerabilities, including code samples

-   Group and filter results

-   Triage results - edit the result predicate (severity, state and comments) directly from the Visual Studio Code console

-   Links to Codebashing lessons

-   Apply Auto Remediation to automatically remediate open source vulnerabilities, by updating to a non-vulnerable package version.

-   "AI Guided Remediation" harnesses the power of AI to help you to understand the vulnerabilities in your code, and resolve them quickly and easily.

- AI Secure Coding Assistant (ASCA) - A lightweight scan engine that runs in the background while you work, enabling developers to identify and remediate secure coding best practice violations as they code.

### Prerequisites
-   An installation of VS Code version 1.63.0 or above

-   You have an **API Key** for your Checkmarx One account. To create an API key, see [Generating an API Key](https://checkmarx.com/resource/documents/en/34965-68618-generating-an-api-key.html).
  > In order to use this integration for running an end-to-end flow of scanning a project and viewing results, the API Key must have at a minimum the out-of-the-box composite role `ast-scanner` as well as the IAM role `default-roles`.

- "git" is installed on your local machine. For installation instructions, see [here](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git).

-   In order to use **AI Generated Remediation**, you need to have an API Key for your GPT account.

## KICS Realtime Scanner

This tool initiates KICS scans directly from their VS Code console. The scan runs automatically whenever an infrastructure file of a [supported type](https://docs.kics.io/latest/platforms/) is saved, either manually or by auto-save. The scan runs only on the file that is open in the editor. The results are shown in the VS Code console, making it easy to remediate the vulnerabilities that are detected. This is a **free tool** provided by Checkmarx for all VS Code users, and does not require the user to submit credentials for a Checkmarx One account.

**GIF - Automatic Remediation for KICS Vulnerabilities**
![Automatic Remediation for KICS Vulnerabilities](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_kics_auto_remediation.gif)

### Key Features

-   Free tool, no Checkmarx account required

-   Run scans directly from your IDE

-   Scans are triggered automatically whenever a file is saved

-   Apply Auto Remediation to automatically fix IaC vulnerabilities

-   AI Guided Remediation”harnesses the power of AI to help you to understand the vulnerabilities in your code, and resolve them quickly and easily.

### Prerequisites

-   You must have a supported container engine (e.g., Docker, Podman etc.) installed and running in your environment.

-   In order to use **AI Generated Remediation**, you need to have an API Key for your GPT account.

## Checkmarx SCA Realtime Scanner

This tool enables VS Code users to initiate SCA scans directly from their VS Code console, and shows detailed results as soon as the scan is completed. The scan identifies the open-source dependencies used in your code and indicates the security risks associated with those packages. The identified packages are shown in a tree structure with an indication of the risk level for each package. You can drill down to show the specific vulnerabilities associated with a package. This is a **free tool** provided by Checkmarx for all VS Code users, and does not require the user to submit credentials for a Checkmarx One account.

### Key Features

-   Free tool, no Checkmarx account required

-   Run scans directly from your IDE

-   View actionable results in your IDE, indicating which of your open-source packages are at risk

-   Provides links to detailed info about the vulnerabilities on the Checkmarx Developer Hub

### Prerequisites

-   In order to get comprehensive results, you need to install all relevant package managers on your local environment, see [Installing Supported Package Managers](https://checkmarx.com/resource/documents/en/34965-19198-installing-supported-package-managers-for-resolver.html).

## Initial Setup
1.   Verify that all prerequisites are in place.

2.   Install the extension from Marketplace.

3.   Configure the extension settings as follows:
  -   For **KICS Realtime Scanner** and **SCA Realtime Scanner** - no
        configuration needed.
  - For SCA Realtime Scanning, if your environment doesn't have access to the internet, then you will need to configure a proxy server in the Settings, under **Checkmarx One: Additional Params**.

 -   For **Checkmarx One Results** - use your Checkmarx One API Key to integrate with your Checkmarx One account, as described [here](https://checkmarx.com/resource/documents/en/34965-123549-installing-and-setting-up-the-checkmarx-vs-code-extension.html#UUID-b74024dd-5f0e-cac7-668c-94049b9d8566_id_VisualStudioCode-ASTResults-SettinguptheExtension).

 -   If you would like to use **AI Guided Remediation**, use your GPT API Key to integrate with your GPT account, as described [here](https://checkmarx.com/resource/documents/en/34965-123549-installing-and-setting-up-the-checkmarx-vs-code-extension.html#UUID-b74024dd-5f0e-cac7-668c-94049b9d8566_section-idm4543400890995233753488463936).


**GIF - Installing and Setting up the Extension**
![Installing and Setting up the Extension](https://raw.githubusercontent.com/Checkmarx/ci-cd-integrations/main/.images/vscode_installation_and_initial_setup.gif "Installing and Setting up the Extension")

## Feedback
We’d love to hear your feedback! If you come across a bug or have a feature request, please let us know by submitting an issue in [GitHub Issues](https://github.com/Checkmarx/ast-vscode-extension/issues).

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

© 2024 Checkmarx Ltd. All Rights Reserved.

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
