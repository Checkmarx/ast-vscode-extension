import * as vscode from 'vscode';
import * as assert from 'assert';
import { PromptSecurity } from '../utils/listener/promptSecurity';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
	const mockContext: vscode.ExtensionContext = {
		globalState: {
			get: () => undefined,
			update: () => Promise.resolve()
		},
		// Other properties of ExtensionContext are omitted for brevity
	} as any;
	let promptSecurity = new PromptSecurity(mockContext, 3000);
    test('getSelectedText returns the selected text', async () => {
        // Set up a mock text editor with a selection
        const document = await vscode.workspace.openTextDocument({ content: 'Hello, world!' });
        const editor = await vscode.window.showTextDocument(document);
        const selection = new vscode.Selection(0, 0, 0, 5);
        editor.selection = selection;

        // Simulate a selection change event
        const event: vscode.TextEditorSelectionChangeEvent = {
            textEditor: editor,
            selections: [selection],
            kind: undefined
        };

        // Test the function
        const selectedText = promptSecurity.getSelectedText(event);
        assert.strictEqual(selectedText, 'Hello');
    });

    test('getLastSelectedCodeSections returns an empty array initially', () => {
        // Set up a mock context
        

        // Bind the mock context to the function
        const boundGetLastSelectedCodeSections = promptSecurity.getLastSelectedCodeSections.bind({ context: mockContext });

        // Test the function
        const codeSections = boundGetLastSelectedCodeSections();
        assert.deepStrictEqual(codeSections, []);
    });
	test('getLastSelectedCodeSections returns an array with the last selection', () => {
        // Set up a mock context
		let lastSelectedCodeSections = [];
        lastSelectedCodeSections.push({
			code: "code",
			filePath: "filePath"
		});
		mockContext.globalState.update('lastSelectedCodeSections', lastSelectedCodeSections);

        // Bind the mock context to the function
        const boundGetLastSelectedCodeSections = promptSecurity.getLastSelectedCodeSections.bind({ context: mockContext });

        // Test the function
        const codeSections = boundGetLastSelectedCodeSections();
        assert.deepStrictEqual(codeSections, [{
			code: "code",
			filePath: "filePath"
		}]);
    });
});