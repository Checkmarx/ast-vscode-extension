/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import "./mocks/vscode-mock";
import { GptResult } from "../models/gptResult";
import * as vscode from "vscode";
import * as path from "path";
import { AstResult } from "../models/results";
import { mockAstResult } from "./mocks/astResult-mock";

describe("GptResult", () => {
  const mockWorkspacePath = "/mock/workspace";

  beforeEach(() => {
    (vscode.workspace.workspaceFolders as any) = [
      {
        uri: { fsPath: mockWorkspacePath },
      },
    ];
  });
  // check path for secret detection
  it("should correctly join workspace path with filename for secret detection", () => {
    const gptResult = new GptResult(mockAstResult as AstResult, undefined);

    const expectedPath = path.join(
      mockWorkspacePath,
      "/.github/workflows/main.yml"
    );
    expect(gptResult.filename).to.equal(expectedPath);
  });
});
