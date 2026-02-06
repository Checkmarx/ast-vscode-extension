"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay =
  exports.validateRootNode =
  exports.validateNestedGroupBy =
  exports.getDetailsView =
  exports.validateSeverities =
  exports.getResults =
  exports.getQuickPickSelector =
  exports.quickPickSelector =
  exports.createTreeSCA =
  exports.initializeSCA =
  exports.initialize =
  exports.createTree =
  exports.createView =
  exports.createControl =
    void 0;
const vscode_extension_tester_1 = require("vscode-extension-tester");
const constants_1 = require("./constants");
async function createControl() {
  const r = await new vscode_extension_tester_1.ActivityBar().getViewControl(
    "Checkmarx"
  );
  return r;
}
exports.createControl = createControl;
async function createView(control) {
  return await control.openView();
}
exports.createView = createView;
async function createTree(view) {
  return await (view === null || view === void 0
    ? void 0
    : view.getContent().getSection("Checkmarx One Results"));
}
exports.createTree = createTree;
async function initialize() {
  const control = await createControl();
  let view;
  if (control) {
    view = await createView(control);
  }
  return await createTree(view);
}
exports.initialize = initialize;
async function initializeSCA() {
  const control = await createControl();
  let view;
  if (control) {
    view = await createView(control);
  }
  return await createTreeSCA(view);
}
exports.initializeSCA = initializeSCA;
async function createTreeSCA(view) {
  return await (view === null || view === void 0
    ? void 0
    : view.getContent().getSection("Checkmarx SCA Realtime Scanner"));
}
exports.createTreeSCA = createTreeSCA;
async function quickPickSelector(input) {
  await input.selectQuickPick(0);
}
exports.quickPickSelector = quickPickSelector;
async function getQuickPickSelector(input) {
  await (0, exports.delay)(constants_1.FIVE_SECONDS);
  const projectList = await input.getQuickPicks();
  await (0, exports.delay)(constants_1.THIRTY_SECONDS);
  return await projectList[0].getText();
}
exports.getQuickPickSelector = getQuickPickSelector;
async function getResults(scan) {
  await (0, exports.delay)(constants_1.FIVE_SECONDS);
  const children = await scan.getChildren();
  await (0, exports.delay)(constants_1.FIVE_SECONDS);
  // Expand the first results
  await children[0].expand();
  await (0, exports.delay)(constants_1.FIVE_SECONDS);
  const type = await children[0].getChildren();
  return type;
}
exports.getResults = getResults;
async function validateSeverities(scan, severity) {
  await (0, exports.delay)(constants_1.FIVE_SECONDS);
  let r = true;
  const children = await scan.getChildren();
  children.forEach((element) => {
    if (element.getLabel() === severity) {
      r = false;
    }
  });
  return r;
}
exports.validateSeverities = validateSeverities;
async function getDetailsView() {
  // Open details view
  try {
    const detailsView = new vscode_extension_tester_1.WebView();
    await (0, exports.delay)(constants_1.FIVE_SECONDS);
    await detailsView.switchToFrame();
    await (0, exports.delay)(constants_1.FIVE_SECONDS);
    return detailsView;
  } catch (error) {
    return undefined;
  }
}
exports.getDetailsView = getDetailsView;
async function validateNestedGroupBy(level, engines) {
  const children = await engines.getChildren();
  await (0, exports.delay)(constants_1.THREE_SECONDS);
  // Recursive case, expand and get childrens from the node
  if (children.length > 0) {
    await children[0].expand();
    await (0, exports.delay)(constants_1.THREE_SECONDS);
    return validateNestedGroupBy(level + 1, children[0]);
  }
  // Stoppage case, when childrens list is empty
  return level;
}
exports.validateNestedGroupBy = validateNestedGroupBy;
async function validateRootNode(scan) {
  await (scan === null || scan === void 0 ? void 0 : scan.expand());
  await (0, exports.delay)(constants_1.THREE_SECONDS);
  // Validate engines type node
  const engines = await (scan === null || scan === void 0
    ? void 0
    : scan.getChildren());
  await (0, exports.delay)(constants_1.THREE_SECONDS);
  const size = engines === null || engines === void 0 ? void 0 : engines.length;
  return [size, engines];
}
exports.validateRootNode = validateRootNode;
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
exports.delay = delay;
//# sourceMappingURL=utils.js.map
