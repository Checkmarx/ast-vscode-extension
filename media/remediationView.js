(function() {
    const vscode = acquireVsCodeApi();

    // Update selection count and bulk action button state
    function updateSelectionUI() {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
        const selectAllCheckbox = document.getElementById('selectAll');
        const selectionCount = document.getElementById('selectionCount');
        const bulkReportBtn = document.getElementById('generateBulkReport');

        if (selectionCount) {
            selectionCount.textContent = `${checkedBoxes.length} selected`;
        }

        if (bulkReportBtn) {
            bulkReportBtn.disabled = checkedBoxes.length === 0;
        }

        if (selectAllCheckbox) {
            selectAllCheckbox.checked = checkboxes.length > 0 && checkedBoxes.length === checkboxes.length;
            selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < checkboxes.length;
        }
    }

    // Handle select all checkbox
    document.addEventListener('change', (event) => {
        if (event.target.id === 'selectAll') {
            const checkboxes = document.querySelectorAll('.row-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = event.target.checked;
            });
            updateSelectionUI();
        } else if (event.target.classList.contains('row-checkbox')) {
            updateSelectionUI();
        }
    });

    // Handle bulk report generation
    document.addEventListener('click', (event) => {
        if (event.target.id === 'generateBulkReport') {
            const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
            const selectedIds = Array.from(checkedBoxes).map(cb => cb.getAttribute('data-id'));

            if (selectedIds.length > 0) {
                vscode.postMessage({
                    command: 'generateBulkReport',
                    ids: selectedIds
                });
            }
            return;
        }
    });

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

    // Initialize selection UI on load
    updateSelectionUI();
})();

