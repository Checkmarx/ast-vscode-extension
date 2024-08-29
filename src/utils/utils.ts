import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { AstResult } from "../models/results";
import {
  constants
} from "./common/constants";
import { GitExtension } from "./types/git";
import CxScan from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/scan/CxScan";
import CxResult from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxResult";

export function getProperty(
  o: AstResult | CxScan,
  propertyName: string
): string {
  const properties = propertyName.split(".");
  let finalObject = o;
  let returnedProperty = "";
  for (const property of properties) {
    if (!finalObject || !(property in finalObject)) {
      return undefined;
    }
    returnedProperty = finalObject[property];
    finalObject = finalObject[property];
  }
  return returnedProperty;
}

export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function isKicsFile(e: vscode.TextDocument): boolean {
  let r = true;
  if (
    !(
      e.fileName.endsWith(".tf") ||
      e.fileName.endsWith(".yml") ||
      e.fileName.endsWith(".yaml") ||
      e.fileName.endsWith(".json") ||
      e.fileName.match("Dockerfile") ||
      e.fileName.endsWith(".auto.tfvars") ||
      e.fileName.endsWith(".terraform.tfvars") ||
      e.fileName.endsWith(".proto") ||
      e.fileName.endsWith(".dockerfile")
    )
  ) {
    r = false;
  }
  return r;
}

export function isSystemFile(e: vscode.TextDocument): boolean {
  return (
    e.uri.scheme.toString() !== "git" &&
    !e.fileName.includes("package.json") &&
    !e.fileName.includes("settings.json")
  );
}

export const PROGRESS_HEADER: vscode.ProgressOptions = {
  location: vscode.ProgressLocation.Notification,
  title: constants.extensionFullName,
  cancellable: true,
};

export function getFilePath() {
  return __dirname;
}

export function getResultsFilePath() {
  return path.join(
    getFilePath(),
    `${constants.resultsFileName}.${constants.resultsFileExtension}`
  );
}

export function getScanLabel(createdAt: string, id: string) {
  return getFormattedDateTime(createdAt) + " " + id;
}

export function getFormattedDateTime(createdAt: string) {
  // convert date to yyyy/mm/dd HH:mm:ss
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month =
    date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1;
  const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate();
  const hours = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
  const minutes =
    date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
  const seconds =
    date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds();
  const dateString =
    year +
    "/" +
    month +
    "/" +
    day +
    " " +
    hours +
    ":" +
    minutes +
    ":" +
    seconds;
  return dateString;
}

export function getFormattedId(label: CxScan, scanList: CxScan[]) {
  if (scanList === null || scanList === undefined || scanList.length === 0) {
    return "";
  }

  return label === scanList[0]
    ? label.id + " (latest)"
    : label.id;
}

export function formatLabel(label: CxScan, scanList: CxScan[]) {
  return label === scanList[0]
    ? getScanLabel(label.createdAt, label.id) + " (latest)"
    : getScanLabel(label.createdAt, label.id);
}

export async function enableButton(button: string) {
  await vscode.commands.executeCommand("setContext", button, true);
}

export async function disableButton(button: string) {
  await vscode.commands.executeCommand("setContext", button, false);
}

export async function getGitAPIRepository() {
  const gitExtension =
    vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;
  return gitExtension.getAPI(1);
}

export async function getResultsJson() {
  const resultJsonPath = getResultsFilePath();
  if (fs.existsSync(resultJsonPath)) {
    return JSON.parse(
      fs
        .readFileSync(resultJsonPath, "utf-8")
        .replace(/:([0-9]{15,}),/g, ':"$1",')
    );
  }
  return { results: [] };
}

export function readResultsFromFile(resultJsonPath: string, scan: string): CxResult[] {
  let results = undefined;
  if (fs.existsSync(resultJsonPath) && scan) {
    const jsonResults = JSON.parse(
      fs
        .readFileSync(resultJsonPath, "utf-8")
        .replace(/:([0-9]{15,}),/g, ':"$1",')
    );
    if (jsonResults.results) {
      results = orderResults(jsonResults.results);
    }
    else {
      results = [];
    }
  }
  return results;
}

export function orderResults(list: CxResult[]): CxResult[] {
  const order = [constants.criticalSeverity, constants.highSeverity, constants.mediumSeverity, constants.lowSeverity, constants.infoSeverity];
  return list.sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)
  );
}

export function updateStatusBarItem(
  text: string,
  show: boolean,
  statusBarItem: vscode.StatusBarItem
) {
  statusBarItem.text = text;
  show ? statusBarItem.show() : statusBarItem.hide();
}
