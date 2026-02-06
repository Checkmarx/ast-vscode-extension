export class SastNode {
  public uniqueId?: string;

  constructor(
    public id: number,
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
    public definitions: number,
    public nodeSystemId: string,
    public nodeHash: string
  ) {}
}
