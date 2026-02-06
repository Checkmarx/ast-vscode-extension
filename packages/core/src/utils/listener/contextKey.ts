import * as vscode from "vscode";
export class ContextKey {
  private readonly _name: string;
  private _lastValue: boolean;

  constructor(name: string) {
    this._name = name;
  }

  public set(value: boolean): boolean {
    if (this._lastValue === value) {
      return false;
    }
    this._lastValue = value;
    vscode.commands.executeCommand("setContext", this._name, this._lastValue);
    return true;
  }
}
