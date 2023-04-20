import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  GROUP_BY_DIRECT_DEPENDENCY,
  GROUP_BY_DIRECT_DEPENDENCY_ACTIVE,
  GROUP_BY_DIRECT_DEPENDENCY_COMMAND,
  GROUP_BY_FILE,
  GROUP_BY_FILE_ACTIVE,
  GROUP_BY_FILE_COMMAND,
  GROUP_BY_LANGUAGE,
  GROUP_BY_LANGUAGE_ACTIVE,
  GROUP_BY_LANGUAGE_COMMAND,
  GROUP_BY_QUERY_NAME,
  GROUP_BY_QUERY_NAME_ACTIVE,
  GROUP_BY_QUERY_NAME_COMMAND,
  GROUP_BY_SEVERITY,
  GROUP_BY_SEVERITY_ACTIVE,
  GROUP_BY_SEVERITY_COMMAND,
  GROUP_BY_STATE,
  GROUP_BY_STATE_ACTIVE,
  GROUP_BY_STATE_COMMAND,
  GROUP_BY_STATUS,
  GROUP_BY_STATUS_ACTIVE,
  GROUP_BY_STATUS_COMMAND,
  REFRESH_TREE,
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
    await vscode.commands.executeCommand(REFRESH_TREE);
    const groupLanguage =
      this.context.globalState.get<boolean>(LANGUAGE_GROUP) ?? false;
    this.updateResultsProviderGroup(GroupBy.language, groupLanguage);
    await updateFilter(this.context, LANGUAGE_GROUP, groupLanguage);
    await vscode.commands.executeCommand(REFRESH_TREE);
    // By default only get results grouped by severity
    const groupBySeverity =
      this.context.globalState.get<boolean>(SEVERITY_GROUP) ?? true;
    this.updateResultsProviderGroup(GroupBy.severity, groupBySeverity);
    await updateFilter(this.context, SEVERITY_GROUP, groupBySeverity);
    await vscode.commands.executeCommand(REFRESH_TREE);
    const groupByStatus =
      this.context.globalState.get<boolean>(STATUS_GROUP) ?? false;
    this.updateResultsProviderGroup(GroupBy.status, groupByStatus);
    await updateFilter(this.context, STATUS_GROUP, groupByStatus);
    await vscode.commands.executeCommand(REFRESH_TREE);
    const groupByState =
      this.context.globalState.get<boolean>(STATE_GROUP) ?? false;
    this.updateResultsProviderGroup(GroupBy.state, groupByState);
    await updateFilter(this.context, STATE_GROUP, groupByState);
    await vscode.commands.executeCommand(REFRESH_TREE);
    const groupByFileName =
      this.context.globalState.get<boolean>(FILE_GROUP) ?? false;
    this.updateResultsProviderGroup(GroupBy.fileName, groupByFileName);
    await updateFilter(this.context, FILE_GROUP, groupByFileName);
    await vscode.commands.executeCommand(REFRESH_TREE);
  }

  private registerGroupByFileCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        GROUP_BY_FILE,
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
        GROUP_BY_FILE_ACTIVE,
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
        GROUP_BY_FILE_COMMAND,
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
        GROUP_BY_LANGUAGE,
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
        GROUP_BY_LANGUAGE_ACTIVE,
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
        GROUP_BY_LANGUAGE_COMMAND,
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
        GROUP_BY_SEVERITY,
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
        GROUP_BY_SEVERITY_ACTIVE,
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
        GROUP_BY_SEVERITY_COMMAND,
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
        GROUP_BY_STATUS,
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
        GROUP_BY_STATUS_ACTIVE,
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
        GROUP_BY_STATUS_COMMAND,
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
        GROUP_BY_STATE,
        async () =>
          await this.group(this.logs, this.context, GroupBy.state, STATE_GROUP)
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        GROUP_BY_STATE_ACTIVE,
        async () =>
          await this.group(this.logs, this.context, GroupBy.state, STATE_GROUP)
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        GROUP_BY_STATE_COMMAND,
        async () =>
          await this.group(this.logs, this.context, GroupBy.state, STATE_GROUP)
      )
    );
  }

  private registerGroupByQueryNameCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        GROUP_BY_QUERY_NAME,
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
        GROUP_BY_QUERY_NAME_ACTIVE,
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
        GROUP_BY_QUERY_NAME_COMMAND,
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
        GROUP_BY_DIRECT_DEPENDENCY,
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
        GROUP_BY_DIRECT_DEPENDENCY_ACTIVE,
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
        GROUP_BY_DIRECT_DEPENDENCY_COMMAND,
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
    await vscode.commands.executeCommand(REFRESH_TREE);
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
