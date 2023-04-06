export class KicsNode {
  constructor(
    public queryId: string,
    public queryName: string,
    public group: string,
    public id: string,
    public severity: string,
    public description: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public data: any
  ) {}
}

export class KicsSummary {
  constructor(
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public HIGH: number,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public MEDIUM: number,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public LOW: number,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public INFO: number
  ) {}
}
