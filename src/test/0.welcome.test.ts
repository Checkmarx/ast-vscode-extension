import { EditorView, InputBox, Workbench } from "vscode-extension-tester";
import { expect } from "chai";
import { initialize } from "./utils/utils";

describe("Welcome view test", () => {
  let bench: Workbench;

  before(async function () {
    this.timeout(8000);
    bench = new Workbench();
  });

  after(async () => {
    await new EditorView().closeAllEditors();
  });

  it("open welcome view and check if exists", async function () {
    let tree = await initialize();
    let welcome = await tree?.findWelcomeContent();
    expect(welcome).is.not.undefined;
  });
});
