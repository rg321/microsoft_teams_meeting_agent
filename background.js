chrome.webRequest.onCompleted.addListener(
    function (details) {
        if (details.url.includes('streamContent')) {
            console.log('++++++++ Stream Content Detected:', details.url);
        }
    },
    { urls: ["*://*.sharepoint.com/*"] }
);
