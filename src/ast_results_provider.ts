import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'vscode';
import { create } from 'lodash';

export enum IssueFilter {
  fileName = "fileName",
  severity = "severity",
  status = "status",
  language = "language"
}

export class AstResultsProvider implements vscode.TreeDataProvider<TreeItem> {
  public issueFilter: IssueFilter = IssueFilter.severity;

  private _onDidChangeTreeData: EventEmitter<TreeItem | undefined> = new EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> = this._onDidChangeTreeData.event;

  private data: TreeItem[] | undefined;

  constructor() {
    this.data = this.generateTree().children;
  }

  refresh(): void {
    this.data = this.generateTree().children;
    this._onDidChangeTreeData.fire(undefined);
  }

  generateTree(): TreeItem {
    const resultJsonPath = path.join(__dirname, 'ast-results.json');
    const jsonResults = JSON.parse(fs.readFileSync(resultJsonPath, 'utf-8'));

    const groups = ['type', this.issueFilter];
    return this.groupBy(jsonResults.results, groups);
  }

  groupBy(list: Object[], groups: string[]): TreeItem {
    const tree = new TreeItem("", undefined, []);
    list.forEach(function (rawObj) {
      const obj = createObj(rawObj);
      if (!obj) {return;}

      const item = new TreeItem(obj.label, obj);

      const node = groups.reduce(function (previousValue: TreeItem, currentValue: string, index: number) {
        const value = obj[currentValue];
        if (!value) {return previousValue;}

        const tree = previousValue.children ?
          previousValue.children.find(item => (item.label === value)) : undefined;
        
        if (tree) {
          previousValue.setDescription(); 
          return tree; 
        }

        const newTree = new TreeItem(value, undefined, []);
        previousValue.children?.push(newTree);
        previousValue.setDescription();
        return newTree;
      }, tree);

      node.children?.push(item);
      node.setDescription();  
    });

    return tree;
  };

  getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: TreeItem | undefined): vscode.ProviderResult<TreeItem[]> {
    if (element === undefined) {
      return this.data;
    }
    return element.children;
  }
}

export class AstResult {
  label: string = "";
  type: string = "";
  fileName: string = "";
  severity: string = "";
  status: string = "";
  language: string = ""; 
  sastNodes: SastNode[] = [];
  scaNode: ScaNode | undefined;
  kicsNode: KicsNode | undefined;

  getHtmlDetails() {
    if (this.sastNodes && this.sastNodes.length > 0) {return this.sastDetails();}
    if (this.scaNode) {return this.scaDetails();}
    if (this.kicsNode ) {return this.kicsDetails();}
    
    return "";
  }

  private sastDetails() {
    let html = `<h3><u>Attack Vector</u></h3>`;
    this.sastNodes.forEach(node => {
      html += `<li><a href="#" 
      class="ast-node"
      data-filename="${node.fileName}" data-line="${node.line}" data-column="${node.column}"
      data-fullName="${node.fullName}">${node.fileName}:${node.line}</a> | [code snip] </li>`;
    });
    return html;
  };

  private scaDetails() {
    let html = `<h3><u>Package Data</u></h3>`;
    
    this.scaNode?.packageData.forEach(node => {
      html +=`<li><a href="${node.comment}">${node.comment}</a></li>`;
    });
    return html;
  }

  private kicsDetails() {
    let html = `<h2><u>Description</u></h2>`;
    html +=`<li>${this.kicsNode ? this.kicsNode.queryName + " [ " + this.kicsNode.queryId + " ]" : ""}</li>`;
    return html;
  }
}

class SastNode {  
  constructor(
    public id:number,
    public column: number,
    public fileName: string,
    public fullName: string,
    public length: number,
    public line: number,
    public methodLine: number,
    public name: string,
    public domType: string,
    public method: string,
    public nodeID: number,
    public definitions:string,
    public nodeSystemId: string,
    public nodeHash: string
  ) { }
}

class ScaNode {  
  constructor(
    public description:string,
    public packageData: PackageData[],
    public packageId: PackageData[]

  ) { }
}

class PackageData {
  constructor(
    public comment: string,
    public type: string,
    public url: string
  ){}
}

class KicsNode {  
  constructor(
    public queryId:string,
    public queryName:string,
    public group:string,
    public description:string,

  ) { }
}

export class TreeItem extends vscode.TreeItem {
  children: TreeItem[] | undefined;
  result: AstResult | undefined;

  constructor(label: string, result?: AstResult, children?: TreeItem[]) {
    super(
      label,
      children === undefined ? vscode.TreeItemCollapsibleState.None :
        vscode.TreeItemCollapsibleState.Expanded);
    this.result = result;
    this.contextValue = result ? "view" : "";
    this.children = children;
  };

  setDescription() {
    this.description = "" + this.children?.length;
  }
}

function createObj(result: Object): AstResult | undefined {
  switch(result.type) {
    case "sast":
      return convertSast(result);
    case "dependency":
      return convertSca(result);
    case "infrastructure":
      return convertKics(result);
  }
  return undefined;
}

function convertSast(result: Object) {
  const astResult = new AstResult();
  astResult.type = result.type;
  astResult.label = result.data.queryName;
  astResult.severity = result.severity;
  astResult.status = result.status;
  astResult.sastNodes = result.data.nodes;
  astResult.language = result.data.languageName;
  astResult.fileName = astResult.sastNodes[0].fileName;
  return astResult;
}

function convertSca(result: Object) {
  const astResult = new AstResult();
  astResult.label = result.id;
  astResult.type = result.type;
  astResult.severity = result.severity;
  astResult.status = result.status;
  astResult.scaNode = result.data;
  return astResult;
}

function convertKics(result: Object) {
  const astResult = new AstResult();
  astResult.type = result.type;
  astResult.label = result.data.queryName;
  astResult.severity = result.severity;
  astResult.status = result.status;
  astResult.kicsNode = result.data;
  return astResult;
}