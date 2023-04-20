import * as vscode from "vscode";
import { Logs } from "../models/logs";
import {
  FILTER_CONFIRMED,
  FILTER_CONFIRMED_ACTIVE,
  FILTER_CONFIRMED_COMMAND,
  FILTER_HIGH,
  FILTER_HIGH_TOGGLE,
  FILTER_HIGH_UNTOGGLE,
  FILTER_IGNORED,
  FILTER_IGNORED_ACTIVE,
  FILTER_IGNORED_COMMAND,
  FILTER_INFO,
  FILTER_INFO_TOGGLE,
  FILTER_INFO_UNTOGGLE,
  FILTER_LOW,
  FILTER_LOW_TOGGLE,
  FILTER_LOW_UNTOGGLE,
  FILTER_MEDIUM,
  FILTER_MEDIUM_TOGGLE,
  FILTER_MEDIUM_UNTOGGLE,
  FILTER_NOT_EXPLOITABLE,
  FILTER_NOT_EXPLOITABLE_ACTIVE,
  FILTER_NOT_EXPLOITABLE_COMMAND,
  FILTER_NOT_IGNORED,
  FILTER_NOT_IGNORED_ACTIVE,
  FILTER_NOT_IGNORED_COMMAND,
  FILTER_PROPOSED,
  FILTER_PROPOSED_ACTIVE,
  FILTER_PROPOSED_COMMAND,
  FILTER_TO_VERIFY,
  FILTER_TO_VERIFY_ACTIVE,
  FILTER_TO_VERIFY_COMMAND,
  FILTER_URGENT,
  FILTER_URGENT_ACTIVE,
  FILTER_URGENT_COMMAND,
  REFRESH_TREE,
} from "../utils/common/commands";
import {
  CONFIRMED_FILTER,
  HIGH_FILTER,
  IGNORED_FILTER,
  INFO_FILTER,
  SeverityLevel,
  LOW_FILTER,
  MEDIUM_FILTER,
  NOT_EXPLOITABLE_FILTER,
  NOT_IGNORED_FILTER,
  PROPOSED_FILTER,
  StateLevel,
  TO_VERIFY_FILTER,
  URGENT_FILTER,
} from "../utils/common/constants";
import { updateFilter } from "../utils/filters";

export class FilterCommand {
  context: vscode.ExtensionContext;
  logs: Logs;
  public activeSeverities: SeverityLevel[] = [
    SeverityLevel.high,
    SeverityLevel.medium,
  ];
  public activeStates: StateLevel[] = [
    StateLevel.confirmed,
    StateLevel.toVerify,
    StateLevel.urgent,
    StateLevel.notIgnored,
  ];
  constructor(context: vscode.ExtensionContext, logs: Logs) {
    this.context = context;
    this.logs = logs;
  }

  public registerFilters() {
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
  }

  public async initializeFilters() {
    this.logs.info(`Initializing severity filters`);
    const high = this.context.globalState.get<boolean>(HIGH_FILTER) ?? true;
    this.updateResultsProvider(SeverityLevel.high, high);
    await updateFilter(this.context, HIGH_FILTER, high);

    const medium = this.context.globalState.get<boolean>(MEDIUM_FILTER) ?? true;
    this.updateResultsProvider(SeverityLevel.medium, medium);
    await updateFilter(this.context, MEDIUM_FILTER, medium);

    const low = this.context.globalState.get<boolean>(LOW_FILTER) ?? true;
    this.updateResultsProvider(SeverityLevel.low, low);
    await updateFilter(this.context, LOW_FILTER, low);

    const info = this.context.globalState.get<boolean>(INFO_FILTER) ?? true;
    this.updateResultsProvider(SeverityLevel.info, info);
    await updateFilter(this.context, INFO_FILTER, info);

    this.logs.info(`Initializing state filters`);
    const notExploitable =
      this.context.globalState.get<boolean>(NOT_EXPLOITABLE_FILTER) ?? false;
    this.updateResultsProviderState(StateLevel.notExploitable, notExploitable);
    await updateFilter(this.context, NOT_EXPLOITABLE_FILTER, notExploitable);

    const proposed =
      this.context.globalState.get<boolean>(PROPOSED_FILTER) ?? false;
    this.updateResultsProviderState(StateLevel.proposed, proposed);
    await updateFilter(this.context, PROPOSED_FILTER, proposed);

    const confirmed =
      this.context.globalState.get<boolean>(CONFIRMED_FILTER) ?? true;
    this.updateResultsProviderState(StateLevel.confirmed, confirmed);
    await updateFilter(this.context, CONFIRMED_FILTER, confirmed);

    const toVerify =
      this.context.globalState.get<boolean>(TO_VERIFY_FILTER) ?? true;
    this.updateResultsProviderState(StateLevel.toVerify, toVerify);
    await updateFilter(this.context, TO_VERIFY_FILTER, toVerify);

    const urgent = this.context.globalState.get<boolean>(URGENT_FILTER) ?? true;
    this.updateResultsProviderState(StateLevel.urgent, urgent);
    await updateFilter(this.context, URGENT_FILTER, urgent);

    const notIgnored =
      this.context.globalState.get<boolean>(NOT_IGNORED_FILTER) ?? true;
    this.updateResultsProviderState(StateLevel.notIgnored, notIgnored);
    await updateFilter(this.context, NOT_IGNORED_FILTER, notIgnored);

    const ignored =
      this.context.globalState.get<boolean>(IGNORED_FILTER) ?? true;
    this.updateResultsProviderState(StateLevel.ignored, ignored);
    await updateFilter(this.context, IGNORED_FILTER, ignored);
    await vscode.commands.executeCommand(REFRESH_TREE);
  }

  private registerFilterHighCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_HIGH_TOGGLE,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.high,
            HIGH_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_HIGH_UNTOGGLE,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.high,
            HIGH_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_HIGH,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.high,
            HIGH_FILTER
          )
      )
    );
  }

  private registerFilterMediumCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_MEDIUM_TOGGLE,
        async () =>
          await this.filter(
            this.logs,
            this.context,

            SeverityLevel.medium,
            MEDIUM_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_MEDIUM_UNTOGGLE,
        async () =>
          await this.filter(
            this.logs,
            this.context,

            SeverityLevel.medium,
            MEDIUM_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_MEDIUM,
        async () =>
          await this.filter(
            this.logs,
            this.context,

            SeverityLevel.medium,
            MEDIUM_FILTER
          )
      )
    );
  }

  private registerFilterLowCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_LOW_TOGGLE,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.low,
            LOW_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_LOW_UNTOGGLE,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.low,
            LOW_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_LOW,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.low,
            LOW_FILTER
          )
      )
    );
  }

  private registerFilterInfoCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_INFO_UNTOGGLE,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.info,
            INFO_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_INFO_TOGGLE,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.info,
            INFO_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_INFO,
        async () =>
          await this.filter(
            this.logs,
            this.context,
            SeverityLevel.info,
            INFO_FILTER
          )
      )
    );
  }

  private registerFilterNotExploitableCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_NOT_EXPLOITABLE,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.notExploitable,
            NOT_EXPLOITABLE_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_NOT_EXPLOITABLE_ACTIVE,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.notExploitable,
            NOT_EXPLOITABLE_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_NOT_EXPLOITABLE_COMMAND,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.notExploitable,
            NOT_EXPLOITABLE_FILTER
          )
      )
    );
  }

  private registerFilterProposedCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_PROPOSED,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.proposed,
            PROPOSED_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_PROPOSED_ACTIVE,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.proposed,
            PROPOSED_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_PROPOSED_COMMAND,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.proposed,
            PROPOSED_FILTER
          )
      )
    );
  }

  private registerFilterConfirmedCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_CONFIRMED,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.confirmed,
            CONFIRMED_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_CONFIRMED_ACTIVE,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.confirmed,
            CONFIRMED_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_CONFIRMED_COMMAND,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.confirmed,
            CONFIRMED_FILTER
          )
      )
    );
  }

  private registerFilterToVerifyCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_TO_VERIFY,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.toVerify,
            TO_VERIFY_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_TO_VERIFY_ACTIVE,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.toVerify,
            TO_VERIFY_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_TO_VERIFY_COMMAND,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.toVerify,
            TO_VERIFY_FILTER
          )
      )
    );
  }

  private registerFilterUrgentCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_URGENT,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.urgent,
            URGENT_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_URGENT_ACTIVE,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.urgent,
            URGENT_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_URGENT_COMMAND,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.urgent,
            URGENT_FILTER
          )
      )
    );
  }

  private registerFilterNotIgnoredCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_NOT_IGNORED,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.notIgnored,
            NOT_IGNORED_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_NOT_IGNORED_ACTIVE,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.notIgnored,
            NOT_IGNORED_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_NOT_IGNORED_COMMAND,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.notIgnored,
            NOT_IGNORED_FILTER
          )
      )
    );
  }

  private registerFilterIgnoredCommand() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_IGNORED,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.ignored,
            IGNORED_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_IGNORED_ACTIVE,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.ignored,
            IGNORED_FILTER
          )
      )
    );
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        FILTER_IGNORED_COMMAND,
        async () =>
          await this.filterState(
            this.logs,
            this.context,
            StateLevel.ignored,
            IGNORED_FILTER
          )
      )
    );
  }

  private updateResultsProvider(
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

  private updateResultsProviderState(
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
    logs.info(`Filtering ${activeSeverities} results`);
    const currentValue = context.globalState.get(filter);
    this.updateResultsProvider(activeSeverities, !currentValue);

    await updateFilter(context, filter, !currentValue);
    await vscode.commands.executeCommand(REFRESH_TREE);
  }

  private async filterState(
    logs: Logs,
    context: vscode.ExtensionContext,
    activeStates: StateLevel,
    filter: string
  ) {
    logs.info(`Filtering ${activeStates} results`);
    const currentValue = context.globalState.get(filter);
    this.updateResultsProviderState(activeStates, !currentValue);

    await updateFilter(context, filter, !currentValue);
    await vscode.commands.executeCommand(REFRESH_TREE);
  }
}
