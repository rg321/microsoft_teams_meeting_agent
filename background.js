// Store the latest captured response
let latestResponse = {
    url: '',
    content: 'No content captured yet',
    timestamp: null
};

// Store request headers temporarily
let requestHeadersStore = {};

// Headers from the original request that we want to include in our fetch
const HEADERS_TO_INCLUDE = [
    'authorization',
    'cookie',
    'x-requestdigest',
    'x-clientservice-clienttag'
];

// Listen for web requests before they're sent
chrome.webRequest.onSendHeaders.addListener(
    function(details) {
        // Store request headers for streamContent URLs
        if (details.url.includes('streamContent')) {
            // Save headers for later use
            const requestHeaders = {};
            details.requestHeaders.forEach(header => {
                if (HEADERS_TO_INCLUDE.includes(header.name.toLowerCase())) {
                    requestHeaders[header.name] = header.value;
                }
            });
            
            // Store temporarily with URL as key
            requestHeadersStore[details.url] = requestHeaders;
            
            // Set a timeout to clean up this entry after 30 seconds
            setTimeout(() => {
                delete requestHeadersStore[details.url];
            }, 30000);
        }
    },
    { urls: ["*://*.sharepoint.com/*"] },
    ["requestHeaders"]
);

// Listen for completed web requests
chrome.webRequest.onCompleted.addListener(
    async function(details) {
        // Check if the URL contains 'streamContent'
        if (details.url.includes('streamContent')) {
            console.log('Stream Content detected:', details.url);
            
            try {
                // Store URL and timestamp immediately
                latestResponse.url = details.url;
                latestResponse.timestamp = new Date().toISOString();
                latestResponse.content = 'Fetching content...';
                
                // Make a new request to get the content
                try {
                    // Get stored headers for this URL
                    const headers = requestHeadersStore[details.url] || {};
                    
                    // Clean up stored headers
                    delete requestHeadersStore[details.url];
                    
                    // Try to extract content from response headers first
                    if (details.responseHeaders) {
                        latestResponse.content += 'Response Headers:\n' + 
                            details.responseHeaders.map(h => `${h.name}: ${h.value}`).join('\n') + '\n\n';
                    }
                    
                    // Try to fetch the content directly
                    // Note: This might not work for authenticated requests
                    const response = await fetch(details.url, {
                        method: 'GET',
                        credentials: 'include',
                        headers: headers
                    });
                    
                    if (response.ok) {
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                            const jsonResponse = await response.json();
                            latestResponse.content = JSON.stringify(jsonResponse);
                        } else {
                            latestResponse.content = await response.text();
                        }
                        console.log('Response content captured successfully');
                    } else {
                        latestResponse.content = `Error fetching content: ${response.status} ${response.statusText}`;
                        console.error('Error fetching content:', response.status, response.statusText);
                    }
                } catch (fetchError) {
                    latestResponse.content = `Note: Could not fetch full response content. This is normal for authenticated requests.\n\n`;
                    latestResponse.content += `The extension detected a streamContent request at:\n${details.url}\n\n`;
                    latestResponse.content += `To view the actual content, you can:\n`;
                    latestResponse.content += `1. Open browser DevTools (F12)\n`;
                    latestResponse.content += `2. Go to the Network tab\n`;
                    latestResponse.content += `3. Filter for "streamContent"\n`;
                    latestResponse.content += `4. Click on the request and view the Response tab\n\n`;
                    
                    console.error('Fetch error:', fetchError);
                }
            } catch (error) {
                console.error('Error processing request:', error);
                latestResponse.content = `Error processing request: ${error.message}`;
            }
        }
    },
    { urls: ["*://*.sharepoint.com/*"] },
    ["responseHeaders"]
);

// Function to get the latest response (will be called from popup)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getLatestResponse') {
        sendResponse(latestResponse);
    }
    return true; // Keep the message channel open for async response
});

// Log when extension is loaded
console.log('Teams Transcript Listener extension loaded');
