import { Node } from "./Node";

export class SCSSecretDetectionNode extends Node {
  constructor(
    id: string,
    description: string,
    severity: string,
    public type: string,
    public status: string,
    public state: string,
    public ruleName: string,
    public fileName: string,
    public line: number,
    public ruleDescription: string,
    public remediation: string,
    public remediationAdditional: string
  ) {
    super(id, description, severity);
  }
}
