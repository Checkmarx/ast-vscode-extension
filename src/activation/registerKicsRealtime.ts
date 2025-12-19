import * as vscode from "vscode";
import { Logs } from "../models/logs";
import { KicsProvider } from "../kics/kicsRealtimeProvider";
import { KICSRealtimeCommand } from "../commands/kicsRealtimeCommand";

export function registerKicsRealtime(
  context: vscode.ExtensionContext,
  logs: Logs,
  kicsStatusBarItem: vscode.StatusBarItem,
  kicsDiagnosticCollection: vscode.DiagnosticCollection
) {
  const kicsProvider = new KicsProvider(
    context,
    logs,
    kicsStatusBarItem,
    kicsDiagnosticCollection,
    [],
    []
  );
  const kicsScanCommand = new KICSRealtimeCommand(context, kicsProvider, logs);
  kicsScanCommand.registerKicsScans();
  return { kicsProvider, kicsScanCommand };
}
