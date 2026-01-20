import { KicsFile } from "./kicsFile";

export class KicsRealtime {
  constructor(
    public category: string,
    public description: string,
    public files: KicsFile[],
    public platform: string,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public query_id: string,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public query_name: string,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public query_url: string,
    public severity: string
  ) {}
}
