import { Node } from "./Node";

export class KicsNode extends Node {
  constructor(
    id: string,
    description: string,
    severity: string,
    public queryId: string,
    public queryName: string,
    public group: string,
    public data: any
  ) {
    super(id, description, severity);
  }
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
