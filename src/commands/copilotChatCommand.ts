import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { commands } from "../utils/common/commands";
import { constants } from "../utils/common/constants";
import { AstResult } from "../models/results";

export class CopilotChatCommand {
    context: vscode.ExtensionContext;
    logs: Logs;

    constructor(context: vscode.ExtensionContext, logs: Logs) {
        this.context = context;
        this.logs = logs;
    }

    /**
     * Detects if we're running in Cursor IDE
     */
    private isCursorIDE(): boolean {
        try {
            // Check if the application name contains "Cursor"
            const appName = vscode.env.appName || '';
            if (appName.toLowerCase().includes('cursor')) {
                return true;
            }
            
            // Alternative check: try to see if Cursor-specific extensions are installed
            const cursorExtensions = vscode.extensions.all.filter(ext => 
                ext.id.toLowerCase().includes('cursor') || 
                (ext.packageJSON?.publisher?.toLowerCase()?.includes('cursor'))
            );
            
            return cursorExtensions.length > 0;
        } catch (err) {
            this.logs.error(`Error detecting IDE type: ${err}`);
            return false; // Default to VS Code if detection fails
        }
    }

    /**
     * Handles opening chat and sending a question in Cursor IDE
     * @param question The question to send to Cursor AI
     * @returns True if successful, false if all methods failed
     */
    private async handleCursorIDE(question: string): Promise<boolean> {
        try {
            this.logs.info("Handling Cursor IDE integration");
            
            // Copy the question to clipboard as a fallback right away
            await vscode.env.clipboard.writeText(question);
            const formattedQuestion = {
                text: question,
                from: 'user'
            };
            "editor.action.en"
            
            // Step 1: Try to open the Cursor chat with composer.startComposerPrompt
            this.logs.info("Opening Cursor chat with composer.startComposerPrompt");
            try {
                // Try to open the chat with the question
                // await vscode.commands.executeCommand("composer.startComposerPrompt");
                await vscode.commands.executeCommand("composer.newAgentChat", "massage to chat ai");
                await vscode.commands.executeCommand("composer.fixerrormessage", "Fix this problem");
                try {
                    await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
                    this.logs.info("Programmatically pasted content from clipboard");
                    vscode.commands.executeCommand('composer.sendToAgent');
                    vscode.commands.executeCommand('list.select');
                    vscode.commands.executeCommand('list.toggleExpand');
                    vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');


                    vscode.window.showInformationMessage("Question pasted into Cursor chat");
                    await vscode.commands.executeCommand('workbench.action.submitComment');
                    vscode.commands.executeCommand('type', { text: '\n' });
                } catch (pasteErr) {
                    this.logs.error(`Failed to programmatically paste: ${pasteErr}`);
                    vscode.window.showInformationMessage("Question copied to clipboard. Please paste it into the Cursor chat.");
                }

                // await vscode.commands.executeCommand(constants.cursorComposerMessage, question)

                this.logs.info("Successfully opened Cursor Composer with question");
                  // Step 2: Try to send the question using composer.sendToAgent
                try {
                    // Wait a moment to ensure the chat is ready
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    this.logs.info("Sending question to Cursor chat with composer.sendToAgent");
                    
                    // Format the question as an object with the proper structure
                    // const formattedQuestion = {
                    //     text: question,
                    //     from: 'user'
                    // };
                    
                    await vscode.commands.executeCommand(constants.cursorComposerSender, formattedQuestion);
                    this.logs.info("Successfully sent question to Cursor chat");
                    vscode.window.showInformationMessage("Query sent to Cursor AI");
                    return true;
                } catch (sendErr) {
                    this.logs.error(`Failed to send question to Cursor chat: ${sendErr}`);
                    // Chat is open but sending failed - inform user to paste from clipboard
                    vscode.window.showInformationMessage("Question copied to clipboard. Please paste it into the Cursor chat.");
                    return true; // Still return true as we successfully opened the chat
                }
            } catch (openErr) {
                this.logs.error(`Failed to open Cursor chat: ${openErr}`);
                vscode.window.showInformationMessage("Could not open Cursor chat. Question copied to clipboard.");
                return false;
            }
        } catch (err) {
            this.logs.error(`Error in Cursor IDE integration: ${err}`);
            vscode.window.showInformationMessage("Question copied to clipboard. Please open Cursor Chat manually.");
            return false;
        }
    }

    public registerCopilotChatCommand() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(commands.openCopilotChat, async (item: any) => {
                try {
                    // Log the action
                    this.logs.info("Opening Copilot Chat to ask about vulnerability");
                    
                    // Debug: Log information about the item
                    this.logs.info(`Item type: ${typeof item}`);
                    this.logs.info(`Item properties: ${Object.keys(item).join(', ')}`);
                    this.logs.info(`Item contextValue: ${item.contextValue}`);
                    this.logs.info(`Has result property: ${item.result !== undefined}`);
                    
                    // Get vulnerability details from the selected item
                    const result = item?.result as AstResult;
                    if (!result) {
                        vscode.window.showErrorMessage("No vulnerability details found. Please select a valid vulnerability.");
                        return;
                    }
                    
                    // Debug: Log information about the result
                    this.logs.info(`Result type: ${typeof result}`);
                    this.logs.info(`Result properties: ${Object.keys(result).join(', ')}`);
                    
                    // Extract relevant information from the vulnerability
                    const vulnName = result.queryName || result.label || "security vulnerability";
                    const severity = result.severity || "High";
                    const language = result.language || "";
                    const category = result.type || "";
                    const fileName = result.fileName || "";
                    const description = result.description || "";
                    
                    // Construct a more detailed message to send to Copilot
                    const question = `Can you explain this ${severity} severity security vulnerability: "${vulnName}" detected in ${language} code? 
It was found in file ${fileName} and categorized as ${category}.
${description ? `Additional description: ${description}` : ''}
How can I fix it in my code?`;
                    
                    // Show info message to user
                    vscode.window.showInformationMessage("Opening Copilot Chat to ask about this vulnerability");
                    
                    // Check if Copilot Chat is available
                    try {
                        // Try to find the Copilot Chat extension
                        const copilotChatExtension = vscode.extensions.getExtension(constants.copilotChatExtensionId);
                          if (!copilotChatExtension) {
                            // Copilot Chat not installed - show installation message
                            const installOption = "Install Copilot Chat";
                            const choice = await vscode.window.showErrorMessage(
                                "GitHub Copilot Chat extension is not installed. Install it to use this feature.",
                                installOption
                            );
                            
                            if (choice === installOption) {
                                // Open the extension in marketplace
                                await vscode.commands.executeCommand('workbench.extensions.search', `@id:${constants.copilotChatExtensionId}`);
                            }
                            return;
                        }

                        // Detect if we're running in Cursor IDE
                        const isCursorIDE = this.isCursorIDE();
                        this.logs.info(`Detected environment: ${isCursorIDE ? 'Cursor IDE' : 'VS Code'}`);
                          if (isCursorIDE) {
                            // Try Cursor IDE specific commands
                            const cursorSuccess = await this.handleCursorIDE(question);
                            if (cursorSuccess) {
                                return;
                            } else {
                                vscode.window.showInformationMessage("Question copied to clipboard. Please open Cursor Chat and paste it.");
                                return;
                            }
                        }
                        
                        // If not in Cursor, try to open Copilot Chat with the modern approach (direct query)
                        try {
                            // Try the modern command that opens chat with a query directly
                            this.logs.info("Trying modern Copilot Chat opening approach");
                            await vscode.commands.executeCommand(
                                constants.copilotNewChatOpenWithQueryCommand);
                            // Wait for the chat to open
                            await vscode.commands.executeCommand(
                                constants.copilotChatOpenWithQueryCommand, 
                                { query: `@copilot ${question}` }
                            );
                            return; // If successful, exit the function
                        } catch (err) {
                            // If the modern approach fails, fall back to the older methods
                            this.logs.info(`Modern Copilot Chat command failed: ${err}. Trying older methods.`);
                            
                            // Try older methods to open Copilot Chat
                            try {
                                // First try the standard command
                                await vscode.commands.executeCommand(constants.copilotShowCommand);
                                
                                // Use a slight delay to ensure the chat window is ready
                                setTimeout(async () => {
                                    try {
                                        // Send the question to Copilot
                                        await vscode.commands.executeCommand(constants.copilotSendRequestCommand, question);
                                    } catch (err) {
                                        // If sending fails, automatically copy to clipboard
                                        await vscode.env.clipboard.writeText(question);
                                        vscode.window.showInformationMessage("Question copied to clipboard. Please paste it into Copilot Chat.");
                                    }
                                }, 1000);
                            } catch (err) {
                                // If the standard command fails, try alternative commands
                                this.logs.info(`First Copilot command failed: ${err}. Trying alternative.`);
                                try {
                                    // Try alternative command (Copilot might use different command in some versions)
                                    await vscode.commands.executeCommand(constants.copilotFocusCommand);
                                    
                                    // Use a slight delay to ensure the chat window is ready
                                    setTimeout(async () => {
                                        try {
                                            await vscode.commands.executeCommand(constants.copilotSendRequestCommand, question);
                                        } catch (e) {
                                            // If sending the question fails, automatically copy and notify the user
                                            await vscode.env.clipboard.writeText(question);
                                            vscode.window.showInformationMessage("Question copied to clipboard. Please paste it into Copilot Chat.");
                                        }
                                    }, 1000);
                                } catch (e) {
                                    // If all commands fail, automatically copy the question to clipboard
                                    this.logs.error(`Could not open Copilot Chat with any command: ${e}`);
                                    await vscode.env.clipboard.writeText(question);
                                    vscode.window.showInformationMessage("Question copied to clipboard. Please open Copilot Chat and paste it.");
                                }
                            }
                        }
                    } catch (err) {
                        this.logs.error(`Error interacting with Copilot Chat: ${err}`);
                        vscode.window.showErrorMessage(`Copilot Chat interaction error: ${err.message}`);
                    }
                } catch (error) {
                    this.logs.error(`Error opening Copilot Chat: ${error}`);
                    vscode.window.showErrorMessage(`Failed to open Copilot Chat: ${error}`);
                }
            })
        );
    }
}
