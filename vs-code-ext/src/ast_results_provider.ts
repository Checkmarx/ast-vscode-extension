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
  unknown
}

export enum IssueFilter {
  fileName,
  severity,
  status,
  language
}


export class AstResultsProvider implements vscode.TreeDataProvider<AstResult> {
  public issueFilter: IssueFilter = IssueFilter.severity;
  private sortList: AstResult[]=[];
  private sastResultCount: number = 0;
  private parentNode: number = 0;
  private sastLabel:string = "SAST("+ this.sastResultCount + ")";
  private scaResultCount: number = 0;
  private scaLabel:string = "SCA("+ this.sastResultCount + ")";
  private kicsResultCount: number = 0;
  private kicsLabel:string = "KICS("+ this.sastResultCount + ")";
  private results: Map<ResultNodeType,AstResult[]> = new Map<ResultNodeType,AstResult[]>();

  private _onDidChangeTreeData: vscode.EventEmitter<undefined> = new vscode.EventEmitter<undefined>();
  readonly onDidChangeTreeData: vscode.Event<undefined> = this._onDidChangeTreeData.event;
  // constructor() {
  //   let fileWatcher = vscode.workspace.createFileSystemWatcher(path.join(__dirname, '/ast-results.json'),false,false,false);
  //   fileWatcher.onDidChange(() => {
  //     this.refresh();
  //     this.getChildren();
  //   });
  // }
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
    
    if (this.pathExists(packageJsonPath)) {
      this.results = this.getAstResultsList(packageJsonPath);
    }
    if(element !== undefined) {
      switch(element.type) {
        case ResultNodeType.sast:
          if(this.results.get(ResultNodeType.sast) !== undefined) {
            this.parentNode = ResultNodeType.sast;
            return Promise.resolve(this.getSastNodeOfType(this.results.get(ResultNodeType.sast)!));
          }
          else {
            throw new Error("Sast results not available");
          }
        case ResultNodeType.kics:
          if(this.results.get(ResultNodeType.kics) !== undefined) {
            this.parentNode = ResultNodeType.kics;
          return Promise.resolve(this.getFileNodeOfType(this.results.get(ResultNodeType.kics)!,ResultNodeType.kics));
          }
          else {
            throw new Error("Kics results not available");
          }
        case ResultNodeType.sca:
          this.parentNode = ResultNodeType.sca;
          if(this.results.get(ResultNodeType.sca) !== undefined) {
            return Promise.resolve(this.getFileNodeOfType(this.results.get(ResultNodeType.sca)!,ResultNodeType.sca));
            }
            else {
              throw new Error("Sca results not available");
            }
        case ResultNodeType.fileName:
        case ResultNodeType.severity:
        case ResultNodeType.status:
        case ResultNodeType.language:
          if(this.parentNode !== ResultNodeType.unknown) {
            let result = this.results.get(this.parentNode);
            console.log("Parent node:",this.parentNode);
          return Promise.resolve(this.getSastOfType(result!, element, ""+ ResultNodeType[this.parentNode]));
          }
          else{
            throw new Error("Did not receive the parent Selection");
          }
         
        default:
          return Promise.resolve([]);
      }
    } else {
      return Promise.resolve(this.getRootChildren());
    }    
  }

  getRootChildren(): AstResult[] {
    const d1 = new AstResult(
      this.sastLabel,
      ResultNodeType.sast,
      "",
      "",
      vscode.TreeItemCollapsibleState.Collapsed
    );
    const d2 = new AstResult(
      this.kicsLabel,
      ResultNodeType.kics,
      "",
      "",
      vscode.TreeItemCollapsibleState.Collapsed
    );
    const d3 = new AstResult(
      this.scaLabel,
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
  getSastOfType(results: AstResult[], element: AstResult, resultContext: string): AstResult[] {
    let items: AstResult[] = [];
    
    for (let result of results) {
    
        if (this.issueFilter === IssueFilter.fileName && result.fileName === element.fileName) { 
          result.contextValue = resultContext;
          items.push(result);
        }
        if (this.issueFilter === IssueFilter.severity && result.severity === element.severity) { 
          result.contextValue = resultContext;
          items.push(result);
        }
        if (this.issueFilter === IssueFilter.status && result.status === element.status) { 
          result.contextValue = resultContext;
          items.push(result);
        }
        if (this.issueFilter === IssueFilter.language && result.language === element.language) { 
          result.contextValue = resultContext;
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
      if (result.type === ResultNodeType.kics) {  
        result.contextValue = "kicksNode";
      
        if (this.issueFilter === IssueFilter.fileName) {
          this.sortByFilename(result,result.contextValue);  
        } else if (this.issueFilter === IssueFilter.severity) {
          this.sortBySeverity(result);  
        }
        else{
          this.sortByLanguage(result);
        }
      }
      if (result.type === ResultNodeType.sca) {  
        result.contextValue = "scaNode";
      
        if (this.issueFilter === IssueFilter.fileName) {
          this.sortByFilename(result,result.contextValue);  
        } else if (this.issueFilter === IssueFilter.severity) {
          this.sortBySeverity(result);  
        }
        else{
          this.sortByLanguage(result);
        }
      }
      // else {
      //   if (this.issueFilter === IssueFilter.fileName) {
      //     this.sortByFilename(result);  
      //   } else if (this.issueFilter === IssueFilter.severity) {
      //     this.sortBySeverity(result);  
      //   }
      //   else{
      //     this.sortByLanguage(result);
      //   }
      // }
    }
    return this.sortList;
  }
  
  getSastNodeOfType(results: AstResult[]): AstResult[]  {    
    this.sortList = [];
    for (let result of results) {
      if (result.type === ResultNodeType.sast) {
        this.sastResultCount += 1;  
        result.contextValue = "sastNode";
        switch(this.issueFilter) {
          case IssueFilter.fileName:
            this.sortByFilename(result,result.contextValue);
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
      // if( result.packageData !== undefined && result.packageData.length > 0) {
      //   astResultItem.fileName = astResultItem.packageData[0].type + "-" + astResultItem.packageData[0].url;
      // }
      this.sortList.push(astResultItem);
    }    
  }

  sortByFilename(result: AstResult,resultContext: string) {
    let astResultItem: any;
    let fileName: string = "";
    if (resultContext === "sastNode" && result.sastNodes !== undefined && result.sastNodes.length > 0) {
      fileName = result.sastNodes[0].fileName;
    }
     else if (resultContext === "scaNode" && result.id !== undefined) {
      fileName = result.id;
    }
    else if (resultContext === "kicsNode" && result.queryName !== undefined) {
      fileName = result.queryName;
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

  private getAstResultsList(resultsJsonPath: string): Map<ResultNodeType,AstResult[]> {
    if(this.pathExists(resultsJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf-8'));
      let sastResult: AstResult[]=[];
      let scaResult: AstResult[] = [];
      let kicsResult: AstResult[] = [];
      let licenseResult: AstResult[] = [];
      let unknownResult: AstResult[] = [];
      let resultMap = new Map<ResultNodeType,AstResult[]>();
      const toResultTree = (index: string, result: SastJsonResult | ScaJsonResult | KicsJsonResult): void => {        
        if (result.type === "sast") {
          result = <SastJsonResult> result;
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
          sastResult.push(astResult);
        } else if(result.type === "dependency") {
          // TODO: fix
          result = <ScaJsonResult> result;
          let astResult: AstResult = new AstResult(
            result.id,
            ResultNodeType.sca,
            result.data.description,
            result.comments,
            vscode.TreeItemCollapsibleState.None
          );
          
          astResult.severity = result.severity;
          if(result.data) {
            astResult.scaNodes = <ScaNode> <unknown>result.data;
          }  
          astResult.description = result.data.description;
          astResult.status = result.status;
          if (astResult.scaNodes !== undefined) {
            astResult.fileName = astResult.scaNodes.description;
          }
          scaResult.push(astResult);
        } 
        
        else if(result.type === "license") {
          // TODO: fix
          let astResult = new AstResult(
            result.type,
            ResultNodeType.sca,
            "",
            result.comments,
            vscode.TreeItemCollapsibleState.Collapsed
          );  
          licenseResult.push(astResult);
        } else if(result.type === "infrastructure") {
          // TODO: fix
          result = <KicsJsonResult> result;
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
          astResult.language = result.data.group;
          // if (astResult.kicsNodes !== undefined && astResult.kicsNodes.length > 0) {
          //   astResult.fileName = astResult.kicsNodes[0].description;
          // }
          if(result.data) {
            astResult.kicsNodes =<KicsNode><unknown>result.data;
          }
          kicsResult.push(astResult);
        } else {
          let astResult= new AstResult(
            "Unknown Vulnerability Type",
            ResultNodeType.vulnerability,
            "",
            "",
            vscode.TreeItemCollapsibleState.None
          ); 
          unknownResult.push(astResult);
        }
      
       resultMap.set(ResultNodeType.sast,sastResult);
       resultMap.set(ResultNodeType.sca,scaResult);
       resultMap.set(ResultNodeType.kics,kicsResult);
       resultMap.set(ResultNodeType.unknown,unknownResult);
      };
      const results = packageJson.results
        ? Object.keys(packageJson.results).map(dep =>
          toResultTree(dep, packageJson.results[dep])
          )
        : [];

        return resultMap;
    } else {
      throw new Error("Results file not available");
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
    public data: SastData,
    public vulnerabilityDetails: VulnerabilityDetails
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
    public comments: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
  }
}
