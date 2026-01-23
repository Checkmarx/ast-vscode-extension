import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  commands
} from "../utils/common/commandBuilder";
import {
  SeverityLevel,
  StateLevel,
  constants
} from "../utils/common/constants";
import { messages } from "../utils/common/messages";
import { updateStateFilter } from "../utils/common/globalState";

export class FilterCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  private activeSeverities: SeverityLevel[] = [
    SeverityLevel.critical,
    SeverityLevel.high,
    SeverityLevel.medium,
  ];
  private activeStates: StateLevel[] = [
    StateLevel.confirmed,
    StateLevel.toVerify,
    StateLevel.urgent,
    StateLevel.notIgnored,
  ];
  constructor(context: vscode.ExtensionContext, logs: Logs) {
    this.context = context;
    this.logs = logs;
  }

  public getAtiveSeverities() {
    return this.activeSeverities;
  }

  public getActiveStates() {
    return this.activeStates;
  }

  public registerFilters() {
    this.registerFilterCriticalCommand();
    this.registerFilterHighCommand();
    this.registerFilterMediumCommand();
    this.registerFilterLowCommand();
    this.registerFilterInfoCommand();
    this.registerFilterNotExploitableCommand();
    this.registerFilterProposedCommand();
    this.registerFilterConfirmedCommand();
    this.registerFilterToVerifyCommand();
    this.registerFilterUrgentCommand();
    this.registerFilterNotIgnoredCommand();
    this.registerFilterIgnoredCommand();
    this.registerFilterSCAHideDevTestCommand();
    this.registerFilterAllCustomStatesCommand();
  }

  public async initializeFilters() {
    this.logs.info(messages.initilizeSeverities);

    const critical = this.context.globalState.get<boolean>(constants.criticalFilter) ?? true;
    this.updateSeverities(SeverityLevel.critical, critical);
    await updateStateFilter(this.context, constants.criticalFilter, critical);

    const high = this.context.globalState.get<boolean>(constants.highFilter) ?? true;
    this.updateSeverities(SeverityLevel.high, high);
    await updateStateFilter(this.context, constants.highFilter, high);

    const medium = this.context.globalState.get<boolean>(constants.mediumFilter) ?? true;
    this.updateSeverities(SeverityLevel.medium, medium);
    await updateStateFilter(this.context, constants.mediumFilter, medium);

    const low = this.context.globalState.get<boolean>(constants.lowFilter) ?? true;
    this.updateSeverities(SeverityLevel.low, low);
    await updateStateFilter(this.context, constants.lowFilter, low);

    const info = this.context.globalState.get<boolean>(constants.infoFilter) ?? true;
    this.updateSeverities(SeverityLevel.info, info);
    await updateStateFilter(this.context, constants.infoFilter, info);

    this.logs.info(messages.initializeState);
    const notExploitable =
      this.context.globalState.get<boolean>(constants.notExploitableFilter) ?? false;
    this.updateState(StateLevel.notExploitable, notExploitable);
    await updateStateFilter(this.context, constants.notExploitableFilter, notExploitable);

    const proposed =
      this.context.globalState.get<boolean>(constants.proposedFilter) ?? false;
    this.updateState(StateLevel.proposed, proposed);
    await updateStateFilter(this.context, constants.proposedFilter, proposed);

    const confirmed =
      this.context.globalState.get<boolean>(constants.confirmedFilter) ?? true;
    this.updateState(StateLevel.confirmed, confirmed);
    await updateStateFilter(this.context, constants.confirmedFilter, confirmed);

    const toVerify =
      this.context.globalState.get<boolean>(constants.toVerifyFilter) ?? true;
    this.updateState(StateLevel.toVerify, toVerify);
    await updateStateFilter(this.context, constants.toVerifyFilter, toVerify);

    const urgent = this.context.globalState.get<boolean>(constants.urgentFilter) ?? true;
    this.updateState(StateLevel.urgent, urgent);
    await updateStateFilter(this.context, constants.urgentFilter, urgent);

    const notIgnored =
      this.context.globalState.get<boolean>(constants.notIgnoredFilter) ?? true;
    this.updateState(StateLevel.notIgnored, notIgnored);
    await updateStateFilter(this.context, constants.notIgnoredFilter, notIgnored);

    const ignored =
      this.context.globalState.get<boolean>(constants.ignoredFilter) ?? true;
    this.updateState(StateLevel.ignored, ignored);
    await updateStateFilter(this.context, constants.ignoredFilter, ignored);

    const scaHideDevTest =
      this.context.globalState.get<boolean>(constants.scaHideDevTestFilter) ?? false;
    await updateStateFilter(this.context, constants.scaHideDevTestFilter, scaHideDevTest);

    const customStates =
      this.context.globalState.get<boolean>(constants.allCustomStatesFilter) ?? true;
    this.updateState(StateLevel.customStates, customStates);
    await updateStateFilter(this.context, constants.allCustomStatesFilter, customStates);

    await vscode.commands.executeCommand(commands.refreshTree);
  }


  private registerFilterCriticalCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterCriticalToggle,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.critical,
            constants.criticalFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterCriticalUntoggle,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.critical,
            constants.criticalFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterCritical,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.critical,
            constants.criticalFilter
          )
      )
    );
  }

  private registerFilterHighCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterHighToggle,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.high,
            constants.highFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterHighUntoggle,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.high,
            constants.highFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterHigh,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.high,
            constants.highFilter
          )
      )
    );
  }

  private registerFilterMediumCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterMediumToggle,
        async () =>
          await this.filter(
            this.logs,
            this.context,

            SeverityLevel.medium,
            constants.mediumFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterMediumUntoggle,
        async () =>
          await this.filter(
            this.logs,
            this.context,

            SeverityLevel.medium,
            constants.mediumFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterMedium,
        async () =>
          await this.filter(
            this.logs,
            this.context,

            SeverityLevel.medium,
            constants.mediumFilter
          )
      )
    );
  }

  private registerFilterLowCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterLowToggle,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.low,
            constants.lowFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterLowUntoggle,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.low,
            constants.lowFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterLow,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.low,
            constants.lowFilter
          )
      )
    );
  }

  private registerFilterInfoCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterInfoUntoggle,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.info,
            constants.infoFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterInfoToggle,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.info,
            constants.infoFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterInfo,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.info,
            constants.infoFilter
          )
      )
    );
  }

  private registerFilterNotExploitableCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterNotExploitable,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.notExploitable,
            constants.notExploitableFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterNotExploitableActive,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.notExploitable,
            constants.notExploitableFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterNotExploitableCommand,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.notExploitable,
            constants.notExploitableFilter
          )
      )
    );
  }

  private registerFilterProposedCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterProposed,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.proposed,
            constants.proposedFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterProposedActive,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.proposed,
            constants.proposedFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterProposedCommand,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.proposed,
            constants.proposedFilter
          )
      )
    );
  }

  private registerFilterConfirmedCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterConfirmed,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.confirmed,
            constants.confirmedFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterConfirmedActive,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.confirmed,
            constants.confirmedFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterConfirmedCommand,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.confirmed,
            constants.confirmedFilter
          )
      )
    );
  }

  private registerFilterToVerifyCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterToVerify,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.toVerify,
            constants.toVerifyFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterToVerifyActive,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.toVerify,
            constants.toVerifyFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterToVerifyCommand,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.toVerify,
            constants.toVerifyFilter
          )
      )
    );
  }

  private registerFilterUrgentCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterUrgent,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.urgent,
            constants.urgentFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterUrgentActive,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.urgent,
            constants.urgentFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterUrgentCommand,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.urgent,
            constants.urgentFilter
          )
      )
    );
  }

  private registerFilterNotIgnoredCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterNotIgnored,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.notIgnored,
            constants.notIgnoredFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterNotIgnoredActive,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.notIgnored,
            constants.notIgnoredFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterNotIgnoredCommand,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.notIgnored,
            constants.notIgnoredFilter
          )
      )
    );
  }

  private registerFilterIgnoredCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterIgnored,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.ignored,
            constants.ignoredFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterIgnoredActive,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.ignored,
            constants.ignoredFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterIgnoredCommand,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.ignored,
            constants.ignoredFilter
          )
      )
    );
  }

  private registerFilterSCAHideDevTestCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterSCAHideDevTest,
        async () =>
          await this.filterSCAHideDevTest(
            this.logs,
            this.context,
            constants.scaHideDevTestFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterSCAHideDevTestActive,
        async () =>
          await this.filterSCAHideDevTest(
            this.logs,
            this.context,
            constants.scaHideDevTestFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterSCAHideDevTestCommand,
        async () =>
          await this.filterSCAHideDevTest(
            this.logs,
            this.context,
            constants.scaHideDevTestFilter
          )
      )
    );
  }
  private registerFilterAllCustomStatesCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterAllCustomStates,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.customStates,
            constants.allCustomStatesFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterAllCustomStatesActive,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.customStates,
            constants.allCustomStatesFilter
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        commands.filterAllCustomStatesCommand,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.customStates,
            constants.allCustomStatesFilter
          )
      )
    );
  }

  private updateSeverities(
    activeSeverities: SeverityLevel,
    include: boolean
  ) {
    const currentIncluded = this.activeSeverities.includes(activeSeverities);
    if (include && !currentIncluded) {
      this.activeSeverities = this.activeSeverities.concat([activeSeverities]);
    }
    if (!include && currentIncluded) {
      this.activeSeverities = this.activeSeverities.filter((x) => {
        return x !== activeSeverities;
      });
    }
  }

  private updateState(
    activeStates: StateLevel,
    include: boolean
  ) {
    const currentIncluded = this.activeStates.includes(activeStates);
    if (include && !currentIncluded) {
      this.activeStates = this.activeStates.concat([activeStates]);
    }
    if (!include && currentIncluded) {
      this.activeStates = this.activeStates.filter((x) => {
        return x !== activeStates;
      });
    }
  }

  private async filter(
    logs: Logs,
    context: vscode.ExtensionContext,
    activeSeverities: SeverityLevel,
    filter: string
  ) {
    logs.info(messages.filterResults(activeSeverities));
    const currentValue = context.globalState.get(filter);
    this.updateSeverities(activeSeverities, !currentValue);

    await updateStateFilter(context, filter, !currentValue);
    await vscode.commands.executeCommand(commands.refreshTree);
  }

  private async filterState(
    logs: Logs,
    context: vscode.ExtensionContext,
    activeStates: StateLevel,
    filter: string
  ) {
    logs.info(messages.filterResults(activeStates));
    const currentValue = context.globalState.get(filter);
    this.updateState(activeStates, !currentValue);

    await updateStateFilter(context, filter, !currentValue);
    await vscode.commands.executeCommand(commands.refreshTree);
  }

  private async filterSCAHideDevTest(
    logs: Logs,
    context: vscode.ExtensionContext,
    filter: string
  ) {
    logs.info(messages.filterResults("SCA Hide Dev/Test"));
    const currentValue = context.globalState.get(filter);
    await updateStateFilter(context, filter, !currentValue);
    await vscode.commands.executeCommand(commands.refreshTree);
  }

}
