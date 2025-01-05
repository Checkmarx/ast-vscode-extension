import { Node } from "./Node";
import CxPackageData from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxPackageData";
import CxScaPackageData from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxScaPackageData";

export class ScaNode extends Node {
  constructor(
    id: string,
    description: string,
    severity: string,
    public packageIdentifier: string,
    public recommendedVersion: string,
    public scaPackageData: CxScaPackageData,
    public packageData: CxPackageData[] // public packageId: CxPackageData[]
  ) {
    super(id, description, severity);
  }
}
