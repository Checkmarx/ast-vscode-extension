(function () {
    const icons = {
        critical: '<span class="codicon codicon-shield"></span>',
        high: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M1.99067 2.18481C3.27904 2.0892 4.54817 1.64712 5.65857 0.858561C5.8624 0.713813 6.13757 0.713813 6.3414 0.858561C7.45181 1.64712 8.72093 2.0892 10.0093 2.18481C10.3037 2.20666 10.5437 2.44729 10.54 2.74247C10.4536 9.51946 8.70872 10.2136 6.21672 11.2049L6.19899 11.212C6.07146 11.2627 5.92851 11.2627 5.80098 11.212L5.78325 11.2049C3.29126 10.2136 1.54636 9.51946 1.46 2.74247C1.45624 2.44729 1.69628 2.20666 1.99067 2.18481Z" fill="#F8788F"/> <path d="M4.17827 8.08421V3.80813H5.08234V5.57243H6.91763V3.80813H7.81962V8.08421H6.91763V6.31782H5.08234V8.08421H4.17827Z" fill="white"/> </svg>',
        medium: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M1.99067 2.18481C3.27904 2.0892 4.54817 1.64712 5.65857 0.858561C5.8624 0.713813 6.13757 0.713813 6.3414 0.858561C7.4518 1.64712 8.72093 2.0892 10.0093 2.18481C10.3037 2.20666 10.5437 2.44729 10.54 2.74247C10.4536 9.51946 8.70871 10.2136 6.21672 11.2049L6.19899 11.212C6.07146 11.2627 5.92851 11.2627 5.80098 11.212L5.78325 11.2049C3.29126 10.2136 1.54636 9.51946 1.46 2.74247C1.45624 2.44729 1.69628 2.20666 1.99067 2.18481Z" fill="#F9AE4D"/> <path d="M3.65576 3.80813H4.77072L5.94831 6.68112H5.99842L7.17601 3.80813H8.29097V8.08421H7.41404V5.301H7.37854L6.27194 8.06333H5.67479L4.56819 5.29056H4.53269V8.08421H3.65576V3.80813Z" fill="white"/> </svg>',
        low: '<span class="codicon codicon-shield"></span>'
    };
    console.log('Risks Management script loaded');

    window.addEventListener('message', event => {

        const message = event.data;
        switch (message.command) {
            case 'getRiskManagementResults': {
                const results = message.data;
                renderApplications(results);
                break;
            }
        }
    });

    function openVulnerabilityDetails(result) {
        // const details = `
        //             <div>${result.name}</div>
        //             <p><strong>Type:</strong> ${result.type}</p>
        //             <p><strong>State:</strong> ${result.state}</p>
        //             <p><strong>Engine:</strong> ${result.engine}</p>
        //             <p><strong>Severity:</strong> ${result.severity}</p>
        //             <p><strong>Risk Score:</strong> ${result.riskScore}</p>
        //             <p><strong>Created At:</strong> ${result.createdAt}</p>
        //             <p><strong>Hash:</strong> ${result.hash}</p>
        //         `;

        // const newWindow = window.open("", "_blank", "width=500,height=500");
        // newWindow.document.write(`
        //             <!DOCTYPE html>
        //             <html lang="en">
        //             <head>
        //                 <meta charset="UTF-8">
        //                 <meta name="viewport" content="width=device-width, initial-scale=1.0">
        //                 <title>${result.name} - Details</title>
        //                 <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        //             </head>
        //             <body class="p-3">
        //                 ${details}
        //             </body>
        //             </html>`);
    }

    function getRiskName(score) {
        if (score === 10) { return "critical"; }
        if (score >= 7) { return "high"; }
        if (score >= 3) { return "medium"; }
        return "low";
    }

    function renderApplications(results) {
        const container = document.getElementById("applicationsContainer");

        results.applicationNameIDMap.forEach((app, index) => {
            const appID = "collapse" + index;
            const isFirst = index === 0 ? "show" : "";

            const appElement = document.createElement("div");

            const matchingResults = results.results.map(result => {
                const matchedScore = result.applicationsScores.find(s => s.applicationID === app.applicationID)?.score;

                const isSCADisabled = result.engine === "SCA";
                const onClickHandler = isSCADisabled
                    ? ""
                    : `onclick="openVulnerabilityDetails(${JSON.stringify(result).replace(/"/g, '&quot;')})"`;
                const tooltip = isSCADisabled ? 'title="Coming soon..."' : "";

                return `
        <div class="result ${isSCADisabled ? 'disabled-result' : ''}" ${onClickHandler} ${tooltip}>
            <span class="risk-score ${{
                        critical: 'critical-risk',
                        high: 'high-risk',
                        medium: 'medium-risk',
                        low: 'low-risk'
                    }[result.severity] || ''}">
    <span>${icons[result.severity]}</span> <span>${matchedScore}</span>
</span>
           <span class="ellipsis"> ${result.name}</span>
        </div>
    `;
            });

            appElement.innerHTML = `
                        <div>
                            <button class="collapsed custom-header" type="button" data-bs-toggle="collapse" data-bs-target="#${appID}">
                                <span class="index">${index + 1}</span>
                                <span class="app-name ellipsis">${app.applicationName}</span>
                                <span class="results-count" data-bs-toggle="tooltip" data-bs-placement="top" title ="Number of risks">${matchingResults.length}</span>
                <span class="risk-score ${getRiskName(app.score)}-risk">
    <span>${icons[getRiskName(app.score)]}</span> <span>${app.score}</span>
</span>
                            </button>
                        </div>
                        <div id="${appID}" class="accordion-collapse collapse ${isFirst}" data-bs-parent="#applicationsContainer">
                            <div class="accordion-body results"></div>
                        </div>
                    `;

            const resultsContainer = appElement.querySelector(".results");

            resultsContainer.innerHTML = matchingResults.join("");
            container.appendChild(appElement);
        });
    }

}());