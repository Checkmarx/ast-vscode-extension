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
  private sastCount: number = 0;
  private scaCount: number = 0;
  private kicsCount:number = 0;

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
    this.sastCount=0;
    this.scaCount=0;
    this.kicsCount=0;
    let results: AstResult[] = [];
    if (this.pathExists(packageJsonPath)) {
      results = this.getAstResultsList(packageJsonPath);
    }
    if(element !== undefined) {
      switch(element.type) {
        case ResultNodeType.sast:
          return Promise.resolve(this.getSastNodeOfType(results));
        case ResultNodeType.kics:
          //return Promise.resolve(this.getSastNodeOfType(results,ResultNodeType.kics));
          return Promise.resolve(this.getKicsNodeOfType(results));
        case ResultNodeType.sca:
          //return Promise.resolve(this.getSastNodeOfType(results,ResultNodeType.sca));
          return Promise.resolve(this.getScaNodeOfType(results));
        case ResultNodeType.fileName:
        case ResultNodeType.severity:
          return Promise.resolve(this.getSastOfType(results, element));
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
    let sastLabel = "SAST" + "(" + this.sastCount + ")";
    let scaLabel = "SCA" + "(" + this.scaCount + ")";
    let kicsLabel = "KICS" + "(" + this.kicsCount + ")";
    let labelList:AstResult[] = [];
    let d1:AstResult;
    let d2:AstResult;
    let d3: AstResult;
    if(this.sastCount >0) {
     d1 = new AstResult(
      sastLabel,
      ResultNodeType.sast,
      "",
      "",
      ResultNodeType.sast,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    labelList.push(d1);
    }
    if(this.kicsCount > 0) {
     d2 = new AstResult(
      kicsLabel,
      ResultNodeType.kics,
      "",
      "",
      ResultNodeType.kics,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    labelList.push(d2);
    }
    if(this.scaCount > 0) {
    d3 = new AstResult(
      scaLabel,
      ResultNodeType.sca,
      "",
      "",
      ResultNodeType.sca,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    labelList.push(d3);
    }
    if(labelList.length === 0) {    
      vscode.window.showInformationMessage('No results found for the selected scan ID');
  }
  return labelList;    
  }
  
  //
  /// Sort By: file, severity, status, language
  //
  getSastOfType(results: AstResult[], element: AstResult): AstResult[] {
    let items: AstResult[] = [];
    let contextValue = "";
    if(element.sourceNodeType === 2){
      contextValue = "sastNode";
    }
    else if(element.sourceNodeType === 0) {
      contextValue = "kicsNode";
    }
    else if(element.sourceNodeType === 1) {
      contextValue = "scaNode";
    }
    for (let result of results) {
      
        if (this.issueFilter === IssueFilter.fileName && result.fileName === element.fileName && result.sourceNodeType === element.sourceNodeType ) { 
          result.contextValue = contextValue;
          items.push(result);
        }
        if (this.issueFilter === IssueFilter.severity && result.severity === element.severity && result.sourceNodeType === element.sourceNodeType) { 
          result.contextValue = contextValue;
          items.push(result);
        }
        if (this.issueFilter === IssueFilter.status && result.status === element.status && result.sourceNodeType === element.sourceNodeType) { 
          result.contextValue = contextValue;
          items.push(result);
        }
        if (this.issueFilter === IssueFilter.language && result.language === element.language && result.sourceNodeType === element.sourceNodeType) { 
          result.contextValue = contextValue;
          items.push(result);
        }
            
    }

    return items;
  }

  // TODO: can this be removed?
  // getSeverityNodeOfType(results: AstResult[], vulnType: ResultNodeType): AstResult[] {    
  //   this.sortList = [];
  //   for (let result of results) {
  //     if (result.type === vulnType) {  
  //       result.contextValue = "sastNode";
  //       this.sortByFilename(result,result.contextValue);
  //     }      
  //   }
  //   return this.sortList;
  // }  

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
      }      
    }
    return this.sortList;
  }
  
  getSastNodeOfType(results: AstResult[]): AstResult[]  {    
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

  getScaNodeOfType(results: AstResult[]): AstResult[] {    
    this.sortList = [];
    for (let result of results) {
      if (result.type === ResultNodeType.sca) {  
        result.contextValue = "scaNode";
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

  getKicsNodeOfType(results: AstResult[]): AstResult[] {    
    this.sortList = [];
    for (let result of results) {
      if (result.type === ResultNodeType.kics) {  
        result.contextValue = "kicsNode";
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
      if (fnr.language === result.language  && fnr.sourceNodeType === result.type) {
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
        result.type,
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
      if (fnr.status === result.status && fnr.sourceNodeType === result.type) {
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
        result.type,
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
      if (fnr.severity === result.severity && fnr.sourceNodeType === result.type) {
        astResultItem = fnr;
        break;
      }
    }
    if (astResultItem === undefined ) {
      astResultItem = new AstResult(
        "Severity",
        ResultNodeType.severity,
        "",
        "",
        result.type,
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
    else if (result.scaNodes !== undefined && result.scaNodes.packageData.length > 0) {
      fileName = result.scaNodes.packageData[0].type;
    }
    else if (result.kicsNodes !== undefined && result.kicsNodes.queryName !== undefined) {
      fileName = result.kicsNodes.queryName;
    }
    for (let fnr of this.sortList ) {
      if (fnr.fileName === fileName && fnr.sourceNodeType === result.type) {
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
        result.type,
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
      const toResultTree = (index: string, result: SastJsonResult | ScaJsonResult | KicsJsonResult): AstResult  => {        
        if (result.type === "sast") {
          this.sastCount += 1;
          result = <SastJsonResult> result;
          let astResult: AstResult = new AstResult(
            result.data.queryName,
            ResultNodeType.sast,
            result.data.queryName,
            result.comments,
            ResultNodeType.sast,
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
          this.scaCount +=1;
          result = <ScaJsonResult> result;
          let astResult: AstResult = new AstResult(
            result.id,
            ResultNodeType.sca,
            result.data.description,
            result.comments,
            ResultNodeType.sca,
            vscode.TreeItemCollapsibleState.None
          );
          
          astResult.severity = result.severity;
          astResult.description = result.data.description;
          astResult.status = result.status;
          if (result.data !== undefined) {
            astResult.scaNodes = result.data;
          }
          return astResult;
        } else if(result.type === "license") {
          // TODO: fix
          return new AstResult(
            result.type,
            ResultNodeType.sca,
            "",
            result.comments,
            ResultNodeType.sca,
            vscode.TreeItemCollapsibleState.Collapsed
          );  
        } else if(result.type === "infrastructure") {
          this.kicsCount += 1;
          result = <KicsJsonResult> result;
          let astResult: AstResult = new AstResult(
            result.data.queryName,
            ResultNodeType.kics,
            result.data.queryName,
            result.comments,
            ResultNodeType.kics,
            vscode.TreeItemCollapsibleState.None
          );            
          astResult.severity = result.severity;
          astResult.status = result.status;
          astResult.language = result.data.group;
          if(result.data) {
            astResult.kicsNodes =<KicsNode><unknown>result.data;
          }
          return astResult;
        }
        else {
          return new AstResult(
            "Unknown Vulnerability Type",
            ResultNodeType.vulnerability,
            "",
            "",
            ResultNodeType.vulnerability,
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

class SastJsonResult {
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

class VulnerabilityDetails {
  constructor(
    public cweId: number,
    public cvss: Cvss,
    public compliances:[],
    public cvssScore: number,
    public cveName: string
  ) {
  }

}

class Cvss {
  constructor(
    public version:number,
    public attackVector: string,
    public availability: string,
    public confidentiality: string,
    public attackComplexity: string
  ){}
}

class ScaJsonResult {
  constructor(
    public id: string,
    public similarityId: string,
    public comments: string,
    public type: string,
    public severity: string,
    public status: string,
    public state: string,
    public data: ScaNode,
    public vulnerabilityDetails: VulnerabilityDetails
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

class KicsNode {  
  constructor(
    public queryId:string,
    public queryName:string,
    public group:string,
    public description:string,

  ) { }
}

class PackageData {
  constructor(
    public comment: string,
    public type: string,
    public url: string
  ){}
}

class ScaResult {
  constructor(
    public id: string
  ) { }
}

class KicsJsonResult {
  constructor(
    public similarityId: string,
    public id: string,
    public comments: string,
    public type: string,
    public severity: string,
    public status: string,
    public state: string,
    public data: KicsNode,
    public vulnerabilityDetails: VulnerabilityDetails

  ) { }
}

export class AstResult extends vscode.TreeItem {
  public sastNodes: SastNode[] = [];
  public scaNodes!: ScaNode;
  public kicsNodes!: KicsNode;
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
    public sourceNodeType:ResultNodeType,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
  }
}
