import * as vscode from 'vscode';

export async function promptListener(
	context: vscode.ExtensionContext
){
	vscode.window.onDidChangeTextEditorSelection(event => {
		if (event.selections.length > 0) {
			const selection = event.selections[0];
			if (!selection.isEmpty) {
				const editor = event.textEditor;
				const code  = editor.document.getText(selection).trim();
				if (code.length > 20) {
					const filePath = editor.document.uri.fsPath;
					let lastSelectedCodeSections: any[] | undefined = context.globalState.get('lastSelectedCodeSections');
					if (!lastSelectedCodeSections) {
						lastSelectedCodeSections = [];
					}
					if (lastSelectedCodeSections.length > 5) {
						lastSelectedCodeSections.shift();
					}
					lastSelectedCodeSections.push({
						code: code,
						filePath: filePath
					});
					context.globalState.update('lastSelectedCodeSections', lastSelectedCodeSections);
				}
			}
		}
	})
};
