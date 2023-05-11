import CxPackageData from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxPackageData";
import CxScaPackageData from "@checkmarxdev/ast-cli-javascript-wrapper/dist/main/results/CxScaPackageData";

export class ScaNode {
  packageIdentifier: string;
  recommendedVersion: string;
  scaPackageData: CxScaPackageData;
  constructor(
    public description: string,
    public id: string,
    public packageData: CxPackageData[],
    public packageId: CxPackageData[]
  ) {}
}
