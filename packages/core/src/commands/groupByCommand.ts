import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  commands
} from "../utils/common/commandBuilder";
import {
  GroupBy,
  constants
} from "../utils/common/constants";
import { messages } from "../utils/common/messages";
import { updateStateFilter } from "../utils/common/globalState";

export class GroupByCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  public activeGroupBy: GroupBy[] = [
    GroupBy.typeLabel,
    GroupBy.scaType,
    GroupBy.severity,
    GroupBy.queryName,
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
    this.logs.info(messages.initilizeGroupBy);
    const groupQueryName =
      this.context.globalState.get<boolean>(constants.queryNameGroup) ?? false;
    this.updateResultsProviderGroup(GroupBy.queryName, groupQueryName);
    await updateStateFilter(this.context, constants.queryNameGroup, groupQueryName);
    await vscode.commands.executeCommand(commands.refreshTree);
    const groupLanguage =
      this.context.globalState.get<boolean>(constants.languageGroup) ?? false;
    this.updateResultsProviderGroup(GroupBy.language, groupLanguage);
    await updateStateFilter(this.context, constants.languageGroup, groupLanguage);
    await vscode.commands.executeCommand(commands.refreshTree);
    // By default only get results grouped by severity
    const groupBySeverity =
      this.context.globalState.get<boolean>(constants.severityGroup) ?? true;
    this.updateResultsProviderGroup(GroupBy.severity, groupBySeverity);
    await updateStateFilter(this.context, constants.severityGroup, groupBySeverity);
    await vscode.commands.executeCommand(commands.refreshTree);
    const groupByStatus =
      this.context.globalState.get<boolean>(constants.statusGroup) ?? false;
    this.updateResultsProviderGroup(GroupBy.status, groupByStatus);
    await updateStateFilter(this.context, constants.statusGroup, groupByStatus);
    await vscode.commands.executeCommand(commands.refreshTree);
    const groupByState =
      this.context.globalState.get<boolean>(constants.stateGroup) ?? false;
    this.updateResultsProviderGroup(GroupBy.state, groupByState);
    await updateStateFilter(this.context, constants.stateGroup, groupByState);
    await vscode.commands.executeCommand(commands.refreshTree);
    const groupByFileName =
      this.context.globalState.get<boolean>(constants.fileGroup) ?? false;
    this.updateResultsProviderGroup(GroupBy.fileName, groupByFileName);
    await updateStateFilter(this.context, constants.fileGroup, groupByFileName);
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
            constants.fileGroup
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
            constants.fileGroup
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
            constants.fileGroup
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
            constants.languageGroup
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
            constants.languageGroup
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
            constants.languageGroup
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
            constants.severityGroup
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
            constants.severityGroup
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
            constants.severityGroup
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
            constants.statusGroup
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
            constants.statusGroup
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
            constants.statusGroup
          )
      )
    );
  }

  private registerGroupByStateCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByState,
        async () =>
          await this.group(this.logs, this.context, GroupBy.state, constants.stateGroup)
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByStateActive,
        async () =>
          await this.group(this.logs, this.context, GroupBy.state, constants.stateGroup)
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.groupByStateCommand,
        async () =>
          await this.group(this.logs, this.context, GroupBy.state, constants.stateGroup)
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
            constants.queryNameGroup
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
            constants.queryNameGroup
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
            constants.queryNameGroup
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
            constants.dependencyGroup
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
            constants.dependencyGroup
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
            constants.dependencyGroup
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
      messages.groupingBy(activeGroupBy === GroupBy.directDependency
        ? "direct dependency"
        : activeGroupBy)
    );
    const currentValue = context.globalState.get(filter);
    this.updateResultsProviderGroup(activeGroupBy, !currentValue);
    await updateStateFilter(context, filter, !currentValue);
    await vscode.commands.executeCommand(commands.refreshTree);
  }

  private updateResultsProviderGroup(activeGroupBy: GroupBy, include: boolean) {
    const fixedOrder: GroupBy[] = this.getFixedGroupOrder();

    const updatedSet = new Set(this.activeGroupBy);

    this.toggleGroupInSet(updatedSet, activeGroupBy, include);

    this.activeGroupBy = this.rebuildGroupByList(updatedSet, fixedOrder);
  }

  private getFixedGroupOrder(): GroupBy[] {
    return [
      GroupBy.typeLabel,
      GroupBy.severity,
      GroupBy.queryName,
      GroupBy.state,
      GroupBy.status,
      GroupBy.language,
      GroupBy.fileName,
      GroupBy.directDependency
    ];
  }

  private toggleGroupInSet(set: Set<GroupBy>, group: GroupBy, include: boolean) {
    if (include) {
      set.add(group);
    } else {
      set.delete(group);
    }
  }

  private rebuildGroupByList(set: Set<GroupBy>, order: GroupBy[]): GroupBy[] {
    const result = order.filter(group => set.has(group));
    return result;
  }
}
