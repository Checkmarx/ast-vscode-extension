export abstract class Node {
  constructor(
    public id: string,
    public description?: string,
    public severity?: string
  ) {}
}
