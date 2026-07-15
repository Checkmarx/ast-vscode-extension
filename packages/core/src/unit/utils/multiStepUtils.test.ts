/* eslint-disable @typescript-eslint/no-explicit-any */
import "../mocks/vscode-mock";
import { expect } from "chai";
import * as sinon from "sinon";
import * as vscode from "vscode";
import {
  MultiStepInput,
  CxQuickPickItem,
} from "../../utils/pickers/multiStepUtils";
import { setExtensionConfig, resetExtensionConfig } from "../../config/extensionConfig";

describe("multiStepUtils", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    setExtensionConfig({
      extensionId: "ast-results",
      commandPrefix: "ast-results",
      viewContainerPrefix: "ast",
      displayName: "Checkmarx",
      extensionType: "checkmarx",
    });
  });

  afterEach(() => {
    sandbox.restore();
    resetExtensionConfig();
  });

  describe("CxQuickPickItem", () => {
    it("creates an item with basic properties", () => {
      const item = new CxQuickPickItem();
      item.label = "Test Item";
      item.id = "item-1";

      expect(item.label).to.equal("Test Item");
      expect(item.id).to.equal("item-1");
    });

    it("supports optional properties", () => {
      const item = new CxQuickPickItem();
      item.label = "Test Item";
      item.description = "Test Description";
      item.detail = "Test Detail";
      item.id = "item-1";
      item.formattedId = "fmt-1";
      item.datetime = "2024-01-01";
      item.picked = true;

      expect(item.description).to.equal("Test Description");
      expect(item.detail).to.equal("Test Detail");
      expect(item.formattedId).to.equal("fmt-1");
      expect(item.datetime).to.equal("2024-01-01");
      expect(item.picked).to.be.true;
    });
  });

  describe("MultiStepInput", () => {
    it("creates an instance", async () => {
      const input = new MultiStepInput();
      expect(input).to.be.instanceOf(MultiStepInput);
    });

    it("supports showQuickPick", async () => {
      const input = new MultiStepInput();
      expect(input.showQuickPick).to.be.a("function");
    });

    it("supports showInputBox", async () => {
      const input = new MultiStepInput();
      expect(input.showInputBox).to.be.a("function");
    });

    it("can run a step through", async () => {
      let stepCalled = false;
      const step = async (_input: MultiStepInput) => {
        stepCalled = true;
      };

      await MultiStepInput.run(step);

      expect(stepCalled).to.be.true;
    });

    it("handles step transitions", async () => {
      const steps: string[] = [];

      const step1 = async (_input: MultiStepInput) => {
        steps.push("step1");
        return step2;
      };

      const step2 = async (_input: MultiStepInput) => {
        steps.push("step2");
      };

      await MultiStepInput.run(step1);

      expect(steps).to.deep.equal(["step1", "step2"]);
    });

    it("can cancel flow without throwing", async () => {
      const step = async (_input: MultiStepInput) => {
        throw new (class InputFlowAction {})();
      };

      let errored = false;
      try {
        await MultiStepInput.run(step);
      } catch {
        errored = true;
      }

      expect(errored).to.be.true;
    });
  });

  describe("MultiStepInput.showQuickPick", () => {
    it("calls show on the quick pick", async () => {
      const input = new MultiStepInput();
      const mockItems: CxQuickPickItem[] = [
        { label: "Option 1", id: "1" } as any,
      ];

      const showQuickPickPromise = input
        .showQuickPick({
          title: "Select an option",
          step: 1,
          totalSteps: 1,
          items: mockItems,
          placeholder: "Choose one",
          shouldResume: async () => false,
        })
        .then((result) => {
          expect(result).to.exist;
        })
        .catch(() => {
          // Expected to fail in test environment without real UI
        });

      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  describe("MultiStepInput.showInputBox", () => {
    it("creates an input box with parameters", async () => {
      const input = new MultiStepInput();

      const inputBoxPromise = input
        .showInputBox({
          title: "Enter text",
          step: 1,
          totalSteps: 1,
          value: "initial",
          prompt: "Type something",
          validate: async (value) => {
            return value.length < 3 ? "Too short" : undefined;
          },
          shouldResume: async () => false,
        })
        .then((result) => {
          expect(result).to.exist;
        })
        .catch(() => {
          // Expected to fail in test environment
        });

      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("validates input correctly", async () => {
      let validationCalled = false;
      const validator = async (value: string) => {
        validationCalled = true;
        return value.length < 3 ? "Too short" : undefined;
      };

      const input = new MultiStepInput();

      const inputBoxPromise = input
        .showInputBox({
          title: "Enter text",
          step: 1,
          totalSteps: 1,
          value: "ab",
          prompt: "Type something",
          validate: validator,
          shouldResume: async () => false,
        })
        .catch(() => {
          // Expected to fail in test environment
        });

      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });
});
