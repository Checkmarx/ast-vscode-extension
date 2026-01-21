export class SCSSecretDetectionNode {
  constructor(
    public id: string,
    public type: string,
    public status: string,
    public state: string,
    public severity: string,
    public created: string,
    public description: string,
    public ruleName: string,
    public fileName: string,
    public line: number,
    public ruleDescription: string,
    public remediation: string
  ) {}
}
