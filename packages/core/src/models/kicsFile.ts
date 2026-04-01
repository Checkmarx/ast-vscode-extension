export class KicsFile {
  constructor(
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public actual_value: string,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public expected_value: string,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public file_name: object[],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public issue_type: string,
    public line: number,
    public remediation: string,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public remediation_type: string,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public search_key: string,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public search_line: number,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public search_value: string,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public similarity_id: string
  ) {}
}
