import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  commands
} from "../utils/common/commands";
import {
  DEPENDENCY_GROUP,
  FILE_GROUP,
  GroupBy,
  LANGUAGE_GROUP,
  QUERY_NAME_GROUP,
  SEVERITY_GROUP,
  STATE_GROUP,
  STATUS_GROUP,
} from "../utils/common/constants";
import { updateFilter } from "../utils/filters";

export class GroupByCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  public activeGroupBy: GroupBy[] = [
    GroupBy.typeLabel,
    GroupBy.scaType,
    GroupBy.severity,
    GroupBy.packageIdentifier,
  ];
  public stateFilter: GroupBy = GroupBy.state;
  constructor(context: vscode.ExtensionContext, logs: Logs) {
    this.context = context;
    this.logs = logs;
  }

  public registerGroupBy() {
    this.registerGroupByFileCommand();
    this.registerGroupByLanguageCommand();
    this.registerGroupBySeverityCommand();
    this.registerGroupByStatusCommand();
    this.registerGroupByStateCommand();
    this.registerGroupByQueryNameCommand();
    this.registerGroupByDirectDependencyCommand();
  }

  public async initializeFilters() {
    this.logs.info(`Initializing group by selections`);
    const groupQueryName =
      this.context.globalState.get<boolean>(QUERY_NAME_GROUP) ?? false;
    this.updateResultsProviderGroup(GroupBy.queryName, groupQueryName);
    await updateFilter(this.context, QUERY_NAME_GROUP, groupQueryName);
    await vscode.commands.executeCommand(commands.refreshTree);
    const groupLanguage =
      this.context.globalState.get<boolean>(LANGUAGE_GROUP) ?? false;
    this.updateResultsProviderGroup(GroupBy.language, groupLanguage);
    await updateFilter(this.context, LANGUAGE_GROUP, groupLanguage);
    await vscode.commands.executeCommand(commands.refreshTree);
    // By default only get results grouped by severity
    const groupBySeverity =
      this.context.globalState.get<boolean>(SEVERITY_GROUP) ?? true;
    this.updateResultsProviderGroup(GroupBy.severity, groupBySeverity);
    await updateFilter(this.context, SEVERITY_GROUP, groupBySeverity);
    await vscode.commands.executeCommand(commands.refreshTree);
    const groupByStatus =
      this.context.globalState.get<boolean>(STATUS_GROUP) ?? false;
    this.updateResultsProviderGroup(GroupBy.status, groupByStatus);
    await updateFilter(this.context, STATUS_GROUP, groupByStatus);
    await vscode.commands.executeCommand(commands.refreshTree);
    const groupByState =
      this.context.globalState.get<boolean>(STATE_GROUP) ?? false;
    this.updateResultsProviderGroup(GroupBy.state, groupByState);
    await updateFilter(this.context, STATE_GROUP, groupByState);
    await vscode.commands.executeCommand(commands.refreshTree);
    const groupByFileName =
      this.context.globalState.get<boolean>(FILE_GROUP) ?? false;
    this.updateResultsProviderGroup(GroupBy.fileName, groupByFileName);
    await updateFilter(this.context, FILE_GROUP, groupByFileName);
    await vscode.commands.executeCommand(commands.refreshTree);
  }

  private registerGroupByFileCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByFile,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.fileName,
            FILE_GROUP
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByFileActive,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.fileName,
            FILE_GROUP
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByFileCommand,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.fileName,
            FILE_GROUP
          )
      )
    );
  }

  private registerGroupByLanguageCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByLanguage,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.language,
            LANGUAGE_GROUP
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByLanguageActive,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.language,
            LANGUAGE_GROUP
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByLanguageCommand,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.language,
            LANGUAGE_GROUP
          )
      )
    );
  }

  private registerGroupBySeverityCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupBySeverity,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.severity,
            SEVERITY_GROUP
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupBySeverityActive,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.severity,
            SEVERITY_GROUP
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupBySeverityCommand,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.severity,
            SEVERITY_GROUP
          )
      )
    );
  }

  private registerGroupByStatusCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByStatus,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.status,
            STATUS_GROUP
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByStatusActive,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.status,
            STATUS_GROUP
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByStatusCommand,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.status,
            STATUS_GROUP
          )
      )
    );
  }

  private registerGroupByStateCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByState,
        async () =>
          await this.group(this.logs, this.context, GroupBy.state, STATE_GROUP)
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByStateActive,
        async () =>
          await this.group(this.logs, this.context, GroupBy.state, STATE_GROUP)
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByStateCommand,
        async () =>
          await this.group(this.logs, this.context, GroupBy.state, STATE_GROUP)
      )
    );
  }

  private registerGroupByQueryNameCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByQueryName,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.queryName,
            QUERY_NAME_GROUP
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByQueryNameActive,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.queryName,
            QUERY_NAME_GROUP
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByQueryNameCommand,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.queryName,
            QUERY_NAME_GROUP
          )
      )
    );
  }

  private registerGroupByDirectDependencyCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByDirectDependency,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.directDependency,
            DEPENDENCY_GROUP
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByDirectDependencyActive,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.directDependency,
            DEPENDENCY_GROUP
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByDirectDependencyCommand,
        async () =>
          await this.group(
            this.logs,
            this.context,
            GroupBy.directDependency,
            DEPENDENCY_GROUP
          )
      )
    );
  }

  private async group(
    logs: Logs,
    context: vscode.ExtensionContext,
    activeGroupBy: GroupBy,
    filter: string
  ) {
    logs.info(
      `Grouping by ${
        activeGroupBy === GroupBy.directDependency
          ? "direct dependency"
          : activeGroupBy
      }`
    );
    const currentValue = context.globalState.get(filter);
    this.updateResultsProviderGroup(activeGroupBy, !currentValue);
    await updateFilter(context, filter, !currentValue);
    await vscode.commands.executeCommand(commands.refreshTree);
  }

  private updateResultsProviderGroup(activeGroupBy: GroupBy, include: boolean) {
    const currentIncluded = this.activeGroupBy.includes(activeGroupBy);
    this.activeGroupBy.pop();
    if (include && !currentIncluded) {
      this.activeGroupBy = this.activeGroupBy.concat([activeGroupBy]);
    }
    if (!include && currentIncluded) {
      this.activeGroupBy = this.activeGroupBy.filter((x) => {
        return x !== activeGroupBy;
      });
    }
    this.activeGroupBy = this.activeGroupBy.concat([GroupBy.packageIdentifier]);
  }
}
