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
					let lastSelectedCodeSections: SelectionBuffer[] | undefined = context.globalState.get('lastSelectedCodeSections');
					if (!lastSelectedCodeSections) {
						lastSelectedCodeSections = [];
					}
					if (lastSelectedCodeSections.length > 5) {
						lastSelectedCodeSections.shift();
					}
					const buffer: SelectionBuffer = {code: code,filePath: filePath};
					lastSelectedCodeSections.push(buffer);
					context.globalState.update('lastSelectedCodeSections', lastSelectedCodeSections);
				}
			}
		}
	});
};
interface SelectionBuffer {
	code: string;
	filePath:string;
}
   