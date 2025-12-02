import * as vscode from "vscode";

export interface PromotionalCardConfig {
    title: string;
    description: string;
    buttonText: string;
    buttonUrl: string;
    backgroundColor?: string;
    textColor?: string;
    buttonColor?: string;
    showCard?: boolean;
}

export class PromotionalCardView {

    public static generateStyles(): string {
        return `
            .promotional-card {
                background-color: var(--vscode-background);
                border-radius: 12px;
                padding-top: 5px;
                text-align: center;
            }
            
            .promotional-content {
                margin: 0 auto;
            }
            
            .promotional-title {
                font-size: 16px;
                font-weight: 700;
                margin-bottom: 12px;
                color: var(--vscode-foreground);
                line-height: 1.3;
            }
            
            .promotional-description {
                font-size: 14px;
                color: rgb(140,140,140);
                margin-bottom: 20px;
                line-height: 1.4;
            }
            
            .promotional-button {
                background-color: rgb(0,129,225);
                color: #ffffff;
                border: none;
                padding: 12px 32px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                text-transform: none;
                letter-spacing: 0.5px;
				width: 100%;
            }
            
            .promotional-button:hover {
                background-color: rgb(0,129,225);
            }
            
            .promotional-card.hidden {
                display: none;
            }
        `;
    }

    public static generateHtml(config: PromotionalCardConfig): string {
        if (!config.showCard) {
            return '';
        }

        const cardStyle = config.backgroundColor ? `style="background-color: ${config.backgroundColor};"` : '';
        const titleStyle = config.textColor ? `style="color: ${config.textColor};"` : '';
        const descStyle = config.textColor ? `style="color: ${config.textColor};"` : '';
        const buttonStyle = config.buttonColor ? `style="background-color: ${config.buttonColor};"` : '';

        return `
        <div class="promotional-card" ${cardStyle}>
            <div class="promotional-content">
                <h2 class="promotional-title" ${titleStyle}>${config.title}</h2>
                <p class="promotional-description" ${descStyle}>${config.description}</p>
                <button 
                    class="promotional-button" 
                    ${buttonStyle}
                    onclick="handlePromotionalAction('${config.buttonUrl}')"
                    title="${config.buttonText}">
                    ${config.buttonText}
                </button>
            </div>
        </div>`;
    }

    public static generateScript(): string {
        return `
            function handlePromotionalAction(url) {
                if (typeof vscode !== 'undefined') {
                    vscode.postMessage({
                        command: 'openPromotionalLink',
                        url: url
                    });
                }
            }
        `;
    }

    public static handleMessage(message: { command: string; url?: string }): void {
        if (message.command === 'openPromotionalLink' && message.url) {
            vscode.env.openExternal(vscode.Uri.parse(message.url));
        }
    }

    public static getAspmConfig(): PromotionalCardConfig {
        return {
            title: "Unlock Full Security Coverage",
            description: "This feature is part of the full Checkmarx platform. Upgrade to give your organization complete application security.",
            buttonText: "Learn more",
            buttonUrl: "https://docs.checkmarx.com/en/34965-68743-using-the-checkmarx-vs-code-extension---checkmarx-one-results.html#UUID-f6ae9b23-44c8-fcf3-bef2-7b136b9001a1_section-idm234938984608896",
            showCard: true
        };
    }

    public static getSastConfig(): PromotionalCardConfig {
        return {
            title: "Unlock Full Security Coverage",
            description: "This feature is part of the full Checkmarx platform. Upgrade to give your organization complete application security.",
            buttonText: "Learn more",
            buttonUrl: "https://docs.checkmarx.com/en/34965-68743-using-the-checkmarx-vs-code-extension---checkmarx-one-results.html#UUID-f6ae9b23-44c8-fcf3-bef2-7b136b9001a1",
            showCard: true
        };
    }

    public static getScaConfig(): PromotionalCardConfig {
        return {
            title: "Unlock Full Security Coverage",
            description: "This feature is part of the full Checkmarx platform. Upgrade to give your organization complete application security.",
            buttonText: "Learn more",
            buttonUrl: "https://docs.checkmarx.com/en/34965-152266-using-the-vs-code-checkmarx-extension---sca-realtime-scanning.html#UUID-1d224150-6409-1d67-6d30-14de69d40ab9",
            showCard: true
        };
    }

    public static embedInWebview(
        config: PromotionalCardConfig,
        existingContent: string,
        position: 'top' | 'bottom' = 'top'
    ): string {
        const promotionalHtml = this.generateHtml(config);
        const script = this.generateScript();

        if (position === 'top') {
            return `
                ${promotionalHtml}
                ${existingContent}
                <script>${script}</script>
            `;
        } else {
            return `
                ${existingContent}
                ${promotionalHtml}
                <script>${script}</script>
            `;
        }
    }
}