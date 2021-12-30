import { PackageData } from "./packageData";

export class ScaNode {
	constructor(
	  public description: string,
	  public packageData: PackageData[],
	  public packageId: PackageData[]
	) {}
  }