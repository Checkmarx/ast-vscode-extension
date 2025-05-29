import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { constants } from "../utils/common/constants";

export class DebugCommand {
    context: vscode.ExtensionContext;
    logs: Logs;

    constructor(context: vscode.ExtensionContext, logs: Logs) {
        this.context = context;
        this.logs = logs;
    }

    public registerDebugCommand() {
        // Register a command to log information about tree items
        this.context.subscriptions.push(
            vscode.commands.registerCommand(`${constants.extensionName}.debugTreeItem`, async (item: any) => {
                try {
                    this.logs.info("Debug tree item called");
                    this.logs.info(`Item type: ${typeof item}`);
                    
                    if (item) {
                        this.logs.info(`Item properties: ${Object.keys(item).join(', ')}`);
                        this.logs.info(`Item contextValue: ${item.contextValue}`);
                        this.logs.info(`Item label: ${item.label}`);
                        this.logs.info(`Has result property: ${item.result !== undefined}`);
                        
                        if (item.result) {
                            this.logs.info(`Result type: ${typeof item.result}`);
                            this.logs.info(`Result properties: ${Object.keys(item.result).join(', ')}`);
                            this.logs.info(`Result severity: ${item.result.severity}`);
                            this.logs.info(`Result label: ${item.result.label}`);
                        }
                    } else {
                        this.logs.info("Item is undefined");
                    }
                    
                    vscode.window.showInformationMessage("Debug info logged to output channel");
                } catch (error) {
                    this.logs.error(`Error in debug command: ${error}`);
                }
            })
        );
    }
}
