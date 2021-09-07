import * as vscode from 'vscode';
import * as fs from 'fs';
import EventEmitter = require('events');
import * as path from 'path';

export enum ResultNodeType {
  kics,
  sca,
  sast,
  fileName,
  severity,
  language,
  status,
  vulnerability,
}

export enum IssueFilter {
  fileName,
  severity,
  status,
  language
}


export class AstResultsProvider implements vscode.TreeDataProvider<AstResult> {
  public issueFilter: IssueFilter = IssueFilter.severity;
  private sortList: AstResult[] = [];

  private _onDidChangeTreeData: vscode.EventEmitter<undefined> = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData: vscode.Event<undefined> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AstResult): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AstResult): Promise<AstResult[]> {
    console.log("TODO: tie the results in with the project chooser!");  
    let packageJsonPath = path.join(__dirname, '/ast-results.json');
    console.log("Package location: ",packageJsonPath);
    let results: AstResult[] = [];
    if (this.pathExists(packageJsonPath)) {
      results = this.getAstResultsList(packageJsonPath);
    }
    if(element !== undefined) {
      switch(element.type) {
        case ResultNodeType.sast:
          return Promise.resolve(this.getSastNodeOfType(results));
        case ResultNodeType.kics:
          return Promise.resolve(this.getFileNodeOfType(results, ResultNodeType.kics));
        case ResultNodeType.sca:
          return Promise.resolve(this.getFileNodeOfType(results, ResultNodeType.sca));
        case ResultNodeType.fileName:
        case ResultNodeType.severity:
        case ResultNodeType.status:
        case ResultNodeType.language:
          return Promise.resolve(this.getSastOfType(results, element));
        default:
          return Promise.resolve([]);
      }
    } else {
      return Promise.resolve(this.getRootChildren());
    }    
  }

  getRootChildren(): AstResult[] {
    const d1 = new AstResult(
      "SAST",
      ResultNodeType.sast,
      "",
      "",
      vscode.TreeItemCollapsibleState.Collapsed
    );
    const d2 = new AstResult(
      "KICS",
      ResultNodeType.kics,
      "",
      "",
      vscode.TreeItemCollapsibleState.Collapsed
    );
    const d3 = new AstResult(
      "SCA",
      ResultNodeType.sca,
      "",
      "",
      vscode.TreeItemCollapsibleState.Collapsed
    );
    return [d1, d2, d3];    
  }
  
  //
  /// Sort By: file, severity, status, language
  //
  getSastOfType(results: AstResult[], element: AstResult): AstResult[] {
    let items: AstResult[] = [];
    
    for (let result of results) {
      if (result.type === ResultNodeType.sast) {
        if (this.issueFilter === IssueFilter.fileName && result.fileName === element.fileName) { 
          result.contextValue = "sastNode";
          items.push(result);
        }
        if (this.issueFilter === IssueFilter.severity && result.severity === element.severity) { 
          result.contextValue = "sastNode";
          items.push(result);
        }
        if (this.issueFilter === IssueFilter.status && result.status === element.status) { 
          result.contextValue = "sastNode";
          items.push(result);
        }
        if (this.issueFilter === IssueFilter.language && result.language === element.language) { 
          result.contextValue = "sastNode";
          items.push(result);
        }
      }      
    }
    return items;
  }

  // TODO: can this be removed?
  getSeverityNodeOfType(results: AstResult[], vulnType: ResultNodeType): AstResult[] {    
    this.sortList = [];
    for (let result of results) {
      if (result.type === vulnType) {  
        result.contextValue = "sastNode";
        this.sortByFilename(result);
      }      
    }
    return this.sortList;
  }  

  // TODO: this needs to be refactored to the correct node type
  getFileNodeOfType(results: AstResult[], vulnType: ResultNodeType): AstResult[] {    
    this.sortList = [];
    for (let result of results) {
      if (result.type === vulnType) {  
        result.contextValue = "sastNode";
        if (this.issueFilter === IssueFilter.fileName) {
          this.sortByFilename(result);  
        } else if (this.issueFilter === IssueFilter.severity) {
          this.sortBySeverity(result);  
        }
        else{
          this.sortByLanguage(result);
        }
      }      
      else {
        if (this.issueFilter === IssueFilter.fileName) {
          this.sortByFilename(result);  
        } else if (this.issueFilter === IssueFilter.severity) {
          this.sortBySeverity(result);  
        }
        else{
          this.sortByLanguage(result);
        }
      }
    }
    return this.sortList;
  }
  
  getSastNodeOfType(results: AstResult[]): AstResult[] {    
    this.sortList = [];
    for (let result of results) {
      if (result.type === ResultNodeType.sast) {  
        result.contextValue = "sastNode";
        switch(this.issueFilter) {
          case IssueFilter.fileName:
            this.sortByFilename(result);
            break;
          case IssueFilter.severity:
            this.sortBySeverity(result);  
            break;
          case IssueFilter.language:
            this.sortByLanguage(result);
            break;
          case IssueFilter.status:
            this.sortByStatus(result);
            break;
        }
      }      
    }
    return this.sortList;
  }  

  sortByLanguage(result: AstResult) {
    let astResultItem: any;
    for (let fnr of this.sortList) {
      if (fnr.language === result.language) {
        astResultItem = fnr;
        break;
      }
    }
    if (astResultItem === undefined) {
      astResultItem = new AstResult(
        result.language,
        ResultNodeType.language,
        "",
        "",
        vscode.TreeItemCollapsibleState.Collapsed
      );
      astResultItem.contextValue = "languageNode";
      astResultItem.language = result.language;
      astResultItem.label = result.language;
      this.sortList.push(astResultItem);
    }    
  }

  sortByStatus(result: AstResult) {
    let astResultItem: any;
    for (let fnr of this.sortList) {
      if (fnr.status === result.status) {
        astResultItem = fnr;
        break;
      }
    }
    if (astResultItem === undefined) {
      astResultItem = new AstResult(
        result.status,
        ResultNodeType.status,
        "",
        "",
        vscode.TreeItemCollapsibleState.Collapsed
      );
      astResultItem.contextValue = "statusNode";
      astResultItem.status = result.status;
      astResultItem.label = result.status;
      this.sortList.push(astResultItem);
    }    
  }

  sortBySeverity(result: AstResult) {
    let astResultItem: any;
    for (let fnr of this.sortList) {
      if (fnr.severity === result.severity) {
        astResultItem = fnr;
        break;
      }
    }
    if (astResultItem === undefined) {
      astResultItem = new AstResult(
        "Severity",
        ResultNodeType.severity,
        "",
        "",
        vscode.TreeItemCollapsibleState.Collapsed
      );
      astResultItem.contextValue = "severityNode";
      astResultItem.severity = result.severity;
      astResultItem.label = result.severity;
      this.sortList.push(astResultItem);
    }    
  }

  sortByFilename(result: AstResult) {
    let astResultItem: any;
    let fileName: string = "";
    if (result.sastNodes !== undefined && result.sastNodes.length > 0) {
      fileName = result.sastNodes[0].fileName;
    }
    for (let fnr of this.sortList) {
      if (fnr.fileName === fileName) {
        astResultItem = fnr;
        break;
      }
    }
    if (astResultItem === undefined) {
      astResultItem = new AstResult(
        "File Name",
        ResultNodeType.fileName,
        "",
        "",
        vscode.TreeItemCollapsibleState.Collapsed
      );
      astResultItem.fileName = fileName;
      astResultItem.label = fileName;
      astResultItem.contextValue = "fileNode";
      this.sortList.push(astResultItem);      
    }
  }

  private getAstResultsList(resultsJsonPath: string): AstResult[] {
    if(this.pathExists(resultsJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf-8'));
      const toResultTree = (index: string, result: JsonResult): AstResult => {        
        if (result.type === "sast") {
          let astResult: AstResult = new AstResult(
            result.data.queryName,
            ResultNodeType.sast,
            result.data.queryName,
            result.comments,
            vscode.TreeItemCollapsibleState.None
          );
          astResult.sastNodes = result.data.nodes;
          astResult.severity = result.severity;
          astResult.status = result.status;
          astResult.language = result.data.languageName;
          if (astResult.sastNodes !== undefined && astResult.sastNodes.length > 0) {
            astResult.fileName = astResult.sastNodes[0].fileName;
          }
          return astResult;
        } else if(result.type === "dependency") {
          // TODO: fix
          return new AstResult(
            result.type,
            ResultNodeType.sca,
            "",
            result.comments,
            vscode.TreeItemCollapsibleState.Collapsed
          );
        } else if(result.type === "license") {
          // TODO: fix
          return new AstResult(
            result.type,
            ResultNodeType.sca,
            "",
            result.comments,
            vscode.TreeItemCollapsibleState.Collapsed
          );  
        } else if(result.type === "infrastructure") {
          // TODO: fix
          let astResult: AstResult = new AstResult(
            // result.type,
            // ResultNodeType.kics,
            // "",
            // result.comments,
            // vscode.TreeItemCollapsibleState.Collapsed
            result.data.queryName,
            ResultNodeType.kics,
            result.data.queryName,
            result.comments,
            vscode.TreeItemCollapsibleState.None
          );            
          astResult.severity = result.severity;
          astResult.status = result.status;
          astResult.language = result.data.languageName;
          if (astResult.sastNodes !== undefined && astResult.sastNodes.length > 0) {
            astResult.fileName = astResult.sastNodes[0].fileName;
          }
          return astResult;
        } else {
          return new AstResult(
            "Unknown Vulnerability Type",
            ResultNodeType.vulnerability,
            "",
            "",
            vscode.TreeItemCollapsibleState.None
          ); 
        }
      };
      const results = packageJson.results
        ? Object.keys(packageJson.results).map(dep =>
          toResultTree(dep, packageJson.results[dep])
          )
        : [];
      return results;
    } else {
      return [];
    }
  }

  private pathExists(p: string): boolean {
    try {
      fs.accessSync(p);
    } catch (err) {
      return false;
    }
    return true;
  }
}

class JsonResult {
  constructor(
    public id: string,
    public similarityId: string,
    public comments: string,
    public type: string,
    public severity: string,
    public status: string,
    public state: string,
    public data: SastData
  ) { }
}

class SastData {  
  constructor(
    public queryName: string,
    public languageName: string,    
    public nodes: SastNode[]
  ) { }
}

class SastNode {  
  constructor(
    public column: number,
    public fileName: string,
    public fullName: string,
    public length: number,
    public line: number,
    public methodLine: number,
    public name: string,
    public domType: string,
    public nodeSystemId: string,
    public nodeHash: string
  ) { }
}

class ScaResult {
  constructor(
    public id: string
  ) { }
}

class KicsResult {
  constructor(
    public group: string,
    public description:string,

  ) { }
}

export class AstResult extends vscode.TreeItem {
  public sastNodes: SastNode[] = [];
  public severity: string = "";
  public fileName: string = "";
  public severityName: string = "";
  public status: string = "";
  public language: string = ""; 
  constructor(
    public readonly label: string,
    public readonly type: ResultNodeType,
    public readonly queryName: string,
    public comment: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
  }
}
