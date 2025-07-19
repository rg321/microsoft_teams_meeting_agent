document.addEventListener('DOMContentLoaded', function() {
    // Elements in the popup
    const responseUrlElement = document.getElementById('response-url');
    const responseTimeElement = document.getElementById('response-time');
    const responseContentElement = document.getElementById('response-content');

    // Function to format JSON for better display
    function formatJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            // If it's not valid JSON, return the original string
            return jsonString;
        }
    }

    // Function to highlight JSON syntax
    function syntaxHighlight(json) {
        if (typeof json !== 'string') {
            json = JSON.stringify(json, null, 2);
        }
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            let cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    // Add CSS for syntax highlighting
    const style = document.createElement('style');
    style.textContent = `
        .string { color: green; }
        .number { color: darkorange; }
        .boolean { color: blue; }
        .null { color: magenta; }
        .key { color: red; }
    `;
    document.head.appendChild(style);

    // Request the latest response from the background script
    chrome.runtime.sendMessage({ action: 'getLatestResponse' }, (response) => {
        if (chrome.runtime.lastError) {
            responseContentElement.textContent = 'Error: ' + chrome.runtime.lastError.message;
            return;
        }

        if (response && response.url) {
            // Display the URL
            responseUrlElement.textContent = response.url;
            
            // Display the timestamp
            if (response.timestamp) {
                responseTimeElement.textContent = 'Captured: ' + new Date(response.timestamp).toLocaleString();
            }
            
            // Display the content, formatted and highlighted if it's JSON
            try {
                const formattedContent = formatJSON(response.content);
                // Try to detect if it's JSON
                if (response.content.trim().startsWith('{') || response.content.trim().startsWith('[')) {
                    responseContentElement.innerHTML = syntaxHighlight(formattedContent);
                } else {
                    responseContentElement.textContent = formattedContent;
                }
            } catch (e) {
                responseContentElement.textContent = response.content;
            }
        } else {
            responseContentElement.textContent = 'No stream content has been captured yet. Navigate to a Teams meeting page and refresh to capture content.';
        }
    });

    // Add refresh button functionality
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            responseContentElement.textContent = 'Loading...';
            location.reload();
        });
    }
});
