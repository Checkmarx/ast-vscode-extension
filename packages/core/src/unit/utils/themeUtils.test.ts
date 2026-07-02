import "../mocks/vscode-mock";
import { expect } from "chai";
import * as vscode from "vscode";
import { ThemeUtils } from "../../utils/themeUtils";

describe("ThemeUtils", () => {
  const originalTheme = (vscode.window as any).activeColorTheme;

  afterEach(() => {
    (vscode.window as any).activeColorTheme = originalTheme;
  });

  it("should default to dark when theme is unavailable", () => {
    (vscode.window as any).activeColorTheme = undefined;
    expect(ThemeUtils.isLightTheme()).to.be.false;
    expect(ThemeUtils.getThemeType()).to.equal("dark");
    expect(ThemeUtils.selectIconByTheme("light.svg", "dark.svg")).to.equal("dark.svg");
  });

  it("should detect light theme", () => {
    (vscode.window as any).activeColorTheme = { kind: vscode.ColorThemeKind.Light };
    expect(ThemeUtils.isLightTheme()).to.be.true;
    expect(ThemeUtils.getThemeType()).to.equal("light");
    expect(ThemeUtils.selectIconByTheme("light.svg", "dark.svg")).to.equal("light.svg");
  });

  it("should detect high contrast light theme", () => {
    (vscode.window as any).activeColorTheme = { kind: vscode.ColorThemeKind.HighContrastLight };
    expect(ThemeUtils.isLightTheme()).to.be.true;
  });
});
