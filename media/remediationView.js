(function() {
    const vscode = acquireVsCodeApi();

    // Event delegation for all buttons
    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!target.matches('[data-action]')) {
            return;
        }

        const action = target.getAttribute('data-action');
        const id = target.getAttribute('data-id');

        // Visual feedback
        target.style.opacity = '0.6';
        setTimeout(() => {
            target.style.opacity = '1';
        }, 200);

        // Send message to extension
        switch (action) {
            case 'viewDiff':
                vscode.postMessage({
                    command: 'viewDiff',
                    id: id
                });
                break;
            case 'viewFlowDiagram':
                vscode.postMessage({
                    command: 'viewFlowDiagram',
                    id: id
                });
                break;
            case 'generateReport':
                vscode.postMessage({
                    command: 'generateReport',
                    id: id
                });
                break;
            case 'deleteRemediation':
                vscode.postMessage({
                    command: 'deleteRemediation',
                    id: id
                });
                break;
            case 'refresh':
                vscode.postMessage({
                    command: 'refresh'
                });
                break;
        }
    });
})();

