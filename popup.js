document.addEventListener('DOMContentLoaded', function() {
    // Elements in the popup
    const responseUrlElement = document.getElementById('response-url');
    const responseTimeElement = document.getElementById('response-time');
    const responseContentElement = document.getElementById('response-content');
    const transcriptViewButton = document.getElementById('transcript-view');
    const rawViewButton = document.getElementById('raw-view');
    const copyButton = document.getElementById('copy-button');

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

    // Function to format transcript entries
    function formatTranscript(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (!data.entries || !Array.isArray(data.entries) || data.entries.length === 0) {
                return '<p>No transcript entries found in the response.</p>';
            }
            
            let html = '<div class="transcript">';
            
            data.entries.forEach(entry => {
                const speaker = entry.speakerDisplayName || 'Unknown Speaker';
                const startTime = entry.startOffset || '00:00:00';
                const text = entry.text || '';
                
                html += `
                    <div class="transcript-entry">
                        <div class="transcript-header">
                            <span class="speaker">${speaker}</span>
                            <span class="timestamp">${startTime}</span>
                        </div>
                        <div class="transcript-text">${text}</div>
                    </div>
                `;
            });
            
            html += '</div>';
            return html;
            
        } catch (e) {
            return '<p>Error parsing transcript data: ' + e.message + '</p>';
        }
    }

    // Add CSS for syntax highlighting and transcript
    const style = document.createElement('style');
    style.textContent = `
        .string { color: green; }
        .number { color: darkorange; }
        .boolean { color: blue; }
        .null { color: magenta; }
        .key { color: red; }
        
        .transcript-entry {
            margin-bottom: 12px;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
        }
        .transcript-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
        }
        .speaker {
            font-weight: bold;
            color: #2c5282;
        }
        .timestamp {
            color: #718096;
            font-size: 0.9em;
        }
        .transcript-text {
            line-height: 1.4;
        }
        .view-buttons {
            margin-bottom: 10px;
        }
        .view-buttons button {
            margin-right: 5px;
        }
        .active {
            background-color: #3367d6;
        }
    `;
    document.head.appendChild(style);

    let currentResponse = null;
    let currentView = 'transcript';

    // Function to update the display based on the current view
    function updateDisplay() {
        if (!currentResponse || !currentResponse.content) {
            responseContentElement.textContent = 'No content available';
            return;
        }

        try {
            if (currentView === 'transcript') {
                // Parse the JSON and format as transcript
                responseContentElement.innerHTML = formatTranscript(currentResponse.content);
                transcriptViewButton.classList.add('active');
                rawViewButton.classList.remove('active');
            } else {
                // Show raw JSON with syntax highlighting
                const formattedContent = formatJSON(currentResponse.content);
                responseContentElement.innerHTML = syntaxHighlight(formattedContent);
                transcriptViewButton.classList.remove('active');
                rawViewButton.classList.add('active');
            }
        } catch (e) {
            console.error('Error updating display:', e);
            responseContentElement.textContent = 'Error displaying content: ' + e.message;
        }
    }

    // Request the latest response from the background script
    chrome.runtime.sendMessage({ action: 'getLatestResponse' }, (response) => {
        if (chrome.runtime.lastError) {
            responseContentElement.textContent = 'Error: ' + chrome.runtime.lastError.message;
            console.error('Error getting response from background:', chrome.runtime.lastError);
            return;
        }

        if (response && response.url) {
            currentResponse = response;
            
            // Display the URL
            responseUrlElement.textContent = response.url;
            
            // Display the timestamp
            if (response.timestamp) {
                responseTimeElement.textContent = 'Captured: ' + new Date(response.timestamp).toLocaleString();
            }
            
            // Check if this is a transcript and set default view
            try {
                const data = JSON.parse(response.content);
                if (data.entries && Array.isArray(data.entries)) {
                    currentView = 'transcript';
                } else {
                    currentView = 'raw';
                }
            } catch (e) {
                console.error('Error parsing JSON:', e);
                currentView = 'raw';
            }
            
            // Update the display
            updateDisplay();
            
        } else {
            responseContentElement.textContent = 'No stream content has been captured yet. Navigate to a Teams meeting page and refresh to capture content.';
        }
    });

    // Add view toggle button functionality
    if (transcriptViewButton) {
        transcriptViewButton.addEventListener('click', () => {
            currentView = 'transcript';
            updateDisplay();
        });
    }
    
    if (rawViewButton) {
        rawViewButton.addEventListener('click', () => {
            currentView = 'raw';
            updateDisplay();
        });
    }
    
    // Add copy button functionality
    if (copyButton) {
        copyButton.addEventListener('click', () => {
            if (!currentResponse || !currentResponse.content) return;
            
            try {
                navigator.clipboard.writeText(currentResponse.content).then(() => {
                    const originalText = copyButton.textContent;
                    copyButton.textContent = 'Copied!';
                    setTimeout(() => {
                        copyButton.textContent = originalText;
                    }, 1500);
                });
            } catch (e) {
                console.error('Failed to copy:', e);
            }
        });
    }

    // Add refresh button functionality
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            responseContentElement.textContent = 'Loading...';
            location.reload();
        });
    }
    
    // Add capture new button functionality
    const captureNewButton = document.getElementById('capture-new-button');
    if (captureNewButton) {
        captureNewButton.addEventListener('click', () => {
            // Send message to background script to reset capture flag
            chrome.runtime.sendMessage({ action: 'resetCapture' }, (response) => {
                if (response && response.success) {
                    // Show status message
                    responseContentElement.textContent = 'Capture flag reset. Navigate to a Teams meeting page with transcripts to capture new content.';
                    
                    // Update button text temporarily
                    const originalText = captureNewButton.textContent;
                    captureNewButton.textContent = 'Ready!';
                    captureNewButton.disabled = true;
                    
                    // Reset button after 2 seconds
                    setTimeout(() => {
                        captureNewButton.textContent = originalText;
                        captureNewButton.disabled = false;
                    }, 2000);
                }
            });
        });
    }
});
