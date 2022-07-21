import { PackageData } from "./packageData";

export class ScaNode {
	packageIdentifier: any;
	recommendedVersion: any;
	scaPackageData: any;
	constructor(
	  public description: string,
	  public id: string,
	  public packageData: PackageData[],
	  public packageId: PackageData[]
	) {}
  }