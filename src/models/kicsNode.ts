export class KicsNode {
	constructor(
	  public queryId: string,
	  public queryName: string,
	  public group: string,
	  public id: string,
	  public severity: string,
	  public description: string,
	  public data:any
	) {}
  }

export class KicsSummary { 
	constructor(
		public HIGH: number,
		public MEDIUM: number,
		public LOW: number,
		public INFO: number,
	  ) {}

};