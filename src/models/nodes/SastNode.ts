// SastNode.ts
import { Node } from "./Node";

export class SastNode extends Node {
  constructor(
    id: string,
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
    public nodeHash: string,
    description?: string,
    severity?: string
  ) {
    super(id, description, severity);
  }
}
