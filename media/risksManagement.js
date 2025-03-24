(function () {
    const icons = {
        critical: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"> <path fill-rule="evenodd" clip-rule="evenodd" d="M5.65869 0.858561C4.54829 1.64712 3.27916 2.0892 1.99079 2.18481C1.6964 2.20666 1.45637 2.44729 1.46013 2.74247C1.54648 9.51946 3.29138 10.2136 5.78337 11.2049L5.80111 11.212C5.92864 11.2627 6.07158 11.2627 6.19911 11.212L6.21684 11.2049C8.70884 10.2136 10.4537 9.51946 10.5401 2.74247C10.5439 2.44729 10.3038 2.20666 10.0094 2.18481C8.72105 2.0892 7.45193 1.64712 6.34152 0.858561C6.1377 0.713813 5.86252 0.713813 5.65869 0.858561ZM4.85361 7.90159C5.16123 8.08989 5.52944 8.18404 5.95824 8.18404C6.31806 8.18404 6.63127 8.11878 6.89787 7.98828C7.16447 7.85591 7.37514 7.67321 7.52988 7.44016C7.68462 7.20525 7.77411 6.93586 7.79835 6.63197H6.83075C6.80092 6.78671 6.74593 6.91814 6.66576 7.02628C6.58559 7.13441 6.48585 7.21737 6.36653 7.27517C6.24908 7.3311 6.11578 7.35906 5.96663 7.35906C5.75596 7.35906 5.57232 7.30313 5.41571 7.19127C5.26097 7.07755 5.14072 6.91628 5.05496 6.70747C4.9692 6.4968 4.92632 6.24512 4.92632 5.95241C4.92632 5.66344 4.9692 5.41548 5.05496 5.20854C5.14259 5.0016 5.2647 4.84313 5.42131 4.73313C5.57791 4.62127 5.75969 4.56534 5.96663 4.56534C6.21086 4.56534 6.40568 4.63525 6.5511 4.77508C6.69838 4.91304 6.7916 5.08549 6.83075 5.29243H7.79835C7.77598 4.98295 7.68462 4.71262 7.52429 4.48144C7.36396 4.2484 7.14862 4.06849 6.87829 3.94171C6.60983 3.81308 6.30128 3.74876 5.95265 3.74876C5.53317 3.74876 5.16962 3.8429 4.862 4.0312C4.55625 4.21764 4.31948 4.47865 4.15169 4.81423C3.9839 5.14795 3.9 5.53294 3.9 5.96919C3.9 6.40358 3.98203 6.78764 4.14609 7.12136C4.31202 7.45321 4.54786 7.71329 4.85361 7.90159Z" fill="#BB2A31"/> <path d="M5.95824 8.18404C5.52944 8.18404 5.16123 8.08989 4.85361 7.90159C4.54786 7.71329 4.31202 7.45321 4.14609 7.12136C3.98203 6.78764 3.9 6.40358 3.9 5.96919C3.9 5.53294 3.9839 5.14795 4.15169 4.81423C4.31948 4.47865 4.55625 4.21764 4.862 4.0312C5.16962 3.8429 5.53317 3.74876 5.95265 3.74876C6.30128 3.74876 6.60983 3.81308 6.87829 3.94171C7.14862 4.06849 7.36396 4.2484 7.52429 4.48144C7.68462 4.71262 7.77598 4.98295 7.79835 5.29243H6.83075C6.7916 5.08549 6.69838 4.91304 6.5511 4.77508C6.40568 4.63525 6.21086 4.56534 5.96663 4.56534C5.75969 4.56534 5.57791 4.62127 5.42131 4.73313C5.2647 4.84313 5.14259 5.0016 5.05496 5.20854C4.9692 5.41548 4.92632 5.66344 4.92632 5.95241C4.92632 6.24512 4.9692 6.4968 5.05496 6.70747C5.14072 6.91628 5.26097 7.07755 5.41571 7.19127C5.57232 7.30313 5.75596 7.35906 5.96663 7.35906C6.11578 7.35906 6.24908 7.3311 6.36653 7.27517C6.48585 7.21737 6.58559 7.13441 6.66576 7.02628C6.74593 6.91814 6.80092 6.78671 6.83075 6.63197H7.79835C7.77411 6.93586 7.68462 7.20525 7.52988 7.44016C7.37514 7.67321 7.16447 7.85591 6.89787 7.98828C6.63127 8.11878 6.31806 8.18404 5.95824 8.18404Z" fill="white"/> </svg>',
        high: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M1.99067 2.18481C3.27904 2.0892 4.54817 1.64712 5.65857 0.858561C5.8624 0.713813 6.13757 0.713813 6.3414 0.858561C7.45181 1.64712 8.72093 2.0892 10.0093 2.18481C10.3037 2.20666 10.5437 2.44729 10.54 2.74247C10.4536 9.51946 8.70872 10.2136 6.21672 11.2049L6.19899 11.212C6.07146 11.2627 5.92851 11.2627 5.80098 11.212L5.78325 11.2049C3.29126 10.2136 1.54636 9.51946 1.46 2.74247C1.45624 2.44729 1.69628 2.20666 1.99067 2.18481Z" fill="#F8788F"/> <path d="M4.17827 8.08421V3.80813H5.08234V5.57243H6.91763V3.80813H7.81962V8.08421H6.91763V6.31782H5.08234V8.08421H4.17827Z" fill="white"/> </svg>',
        medium: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M1.99067 2.18481C3.27904 2.0892 4.54817 1.64712 5.65857 0.858561C5.8624 0.713813 6.13757 0.713813 6.3414 0.858561C7.4518 1.64712 8.72093 2.0892 10.0093 2.18481C10.3037 2.20666 10.5437 2.44729 10.54 2.74247C10.4536 9.51946 8.70871 10.2136 6.21672 11.2049L6.19899 11.212C6.07146 11.2627 5.92851 11.2627 5.80098 11.212L5.78325 11.2049C3.29126 10.2136 1.54636 9.51946 1.46 2.74247C1.45624 2.44729 1.69628 2.20666 1.99067 2.18481Z" fill="#F9AE4D"/> <path d="M3.65576 3.80813H4.77072L5.94831 6.68112H5.99842L7.17601 3.80813H8.29097V8.08421H7.41404V5.301H7.37854L6.27194 8.06333H5.67479L4.56819 5.29056H4.53269V8.08421H3.65576V3.80813Z" fill="white"/> </svg>',
        low: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"> <path d="M1.99069 2.18481C3.27906 2.0892 4.54818 1.64712 5.65859 0.858561C5.86241 0.713813 6.13759 0.713813 6.34141 0.858561C7.45182 1.64712 8.72094 2.0892 10.0093 2.18481C10.3037 2.20666 10.5437 2.44729 10.54 2.74247C10.4536 9.51946 8.70873 10.2136 6.21674 11.2049L6.199 11.212C6.07147 11.2627 5.92853 11.2627 5.801 11.212L5.78327 11.2049C3.29127 10.2136 1.54638 9.51946 1.46002 2.74247C1.45626 2.44729 1.6963 2.20666 1.99069 2.18481Z" fill="#419128"/> <path d="M4.70366 8.08421V3.80813H5.60773V7.33882H7.44093V8.08421H4.70366Z" fill="white"/> </svg>'
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
                // const matchedScore = result.applicationsScores.find(s => s.applicationID === app.applicationID)?.score;

                const isSCA = result.engine.toLowerCase() === "sca";
                const onClickHandler = isSCA
                    ? ""
                    : `onclick="openVulnerabilityDetails(${JSON.stringify(result).replace(/"/g, '&quot;')})"`;
                const tooltip = isSCA ? 'title="Coming soon..." data-bs-toggle="tooltip" data-bs-placement="top"' : "";

                return `
        <div class="result ${isSCA ? 'disabled-result' : ''}" ${onClickHandler} ${tooltip}>
            <span class="risk-score ${{
                        critical: 'critical-risk',
                        high: 'high-risk',
                        medium: 'medium-risk',
                        low: 'low-risk'
                    }[result.severity] || ''}">
    <span>${icons[result.severity]}</span> <span>${result.riskScore}</span>
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

            enableBootstrapTooltips();

        });
    }
    
    function enableBootstrapTooltips() {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltipTriggerList.forEach(tooltipTriggerEl => {
            new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        enableBootstrapTooltips();
    });
}());