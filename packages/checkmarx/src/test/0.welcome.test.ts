import { EditorView, Workbench } from "vscode-extension-tester";
import { expect } from "chai";
import { initialize } from "./utils/utils";

describe("Welcome view test", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let bench: Workbench;

  // Opens the Checkmarx sidebar once before any test runs.
  before(async function () {
    this.timeout(100000);
    bench = new Workbench();
    await initialize();
  });

  after(async () => {
    await new EditorView().closeAllEditors();
  });

  // Verifies the sidebar shows welcome content when no scan is loaded yet.
  it("open welcome view and check if exists", async function () {
    this.timeout(30000);
    const tree = await initialize();
    const welcome = await tree?.findWelcomeContent();
    expect(welcome).is.not.undefined;
  });
});
