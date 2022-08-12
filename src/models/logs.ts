import * as vscode from 'vscode';

export class Logs {
    output: vscode.OutputChannel;

    constructor(
        output: vscode.OutputChannel
    ) {
        this.output = output;
    }

    public log(level: string, message: string) {
        this.output.appendLine("[" + level + " - " + new Date().toLocaleTimeString() + "] " + message);
    }

    public info(message: string) {
        this.log("INFO", message);
    }

    public warn(message: string) {
        this.log("WARN", message);
    }

    public error(message: string) {
        this.log("ERROR", message);
    }

    public show() {
        this.output.show();
    }
}