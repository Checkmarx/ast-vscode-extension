import { SastNode } from "./SastNode";

export class MultipleSastNode {
  private nodes: SastNode[];

  constructor(nodes: SastNode[]) {
    this.nodes = nodes;
  }

  getNodes(): SastNode[] {
    return this.nodes;
  }

  getNode(index: number): SastNode | undefined {
    return this.nodes[index];
  }

  addNode(node: SastNode): void {
    this.nodes.push(node);
  }

  removeNode(index: number): void {
    this.nodes.splice(index, 1);
  }

  get length(): number {
    return this.nodes.length;
  }

  // Additional utility to iterate over nodes
  forEach(callback: (node: SastNode, index: number) => void): void {
    this.nodes.forEach(callback);
  }
}
