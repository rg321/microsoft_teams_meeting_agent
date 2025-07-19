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
    'x-clientservice-clienttag',
    'accept',
    'accept-language',
    'application',
    'priority',
    'referer',
    'scenario',
    'type',
    'user-agent',
    'x-ms-client-request-id',
    'x-requeststats'
];

// Listen for web requests before they're sent
chrome.webRequest.onSendHeaders.addListener(
    function(details) {
        // Store request headers for streamContent URLs
        if (details.url.includes('streamContent')) {
            console.log('Capturing headers for streamContent request');
            
            // Save headers for later use
            const requestHeaders = {};
            details.requestHeaders.forEach(header => {
                // Include all headers that might be needed for authentication
                if (HEADERS_TO_INCLUDE.includes(header.name.toLowerCase())) {
                    requestHeaders[header.name] = header.value;
                    console.log(`Stored header: ${header.name}`);
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
    { urls: ["*://*.sharepoint.com/*", "*://*.microsoft.com/*"] },
    ["requestHeaders"]
);

// Listen for completed web requests
chrome.webRequest.onCompleted.addListener(
    async function(details) {
        // Check if the URL contains 'streamContent'
        if (details.url.includes('streamContent')) {
            console.log('Stream Content detected:', details.url);
            console.log('Response status:', details.statusCode);
            
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
                    
                    // Store response headers but don't include them in the content
                    latestResponse.headers = {};
                    if (details.responseHeaders) {
                        details.responseHeaders.forEach(h => {
                            latestResponse.headers[h.name] = h.value;
                        });
                    }
                    
                    // Try to fetch the content directly with all the necessary headers
                    console.log('Attempting to fetch content with stored headers');
                    const response = await fetch(details.url, {
                        method: 'GET',
                        credentials: 'include',
                        headers: headers,
                        cache: 'no-store'
                    });
                    
                    if (response.ok) {
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                            const jsonResponse = await response.json();
                            latestResponse.content = JSON.stringify(jsonResponse);
                            
                            // Check if this is a transcript response
                            if (jsonResponse && jsonResponse.entries && Array.isArray(jsonResponse.entries)) {
                                latestResponse.isTranscript = true;
                                latestResponse.entryCount = jsonResponse.entries.length;
                                console.log(`Transcript captured with ${jsonResponse.entries.length} entries`);
                            }
                        } else {
                            latestResponse.content = await response.text();
                        }
                        console.log('Response content captured successfully');
                    } else {
                        latestResponse.content = `Error fetching content: ${response.status} ${response.statusText}`;
                        console.error('Error fetching content:', response.status, response.statusText);
                    }
                } catch (fetchError) {
                    latestResponse.content = `{"error": "Could not fetch full response content. This is normal for authenticated requests."}`;
                    latestResponse.fetchError = true;
                    
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
