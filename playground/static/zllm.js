document.addEventListener('DOMContentLoaded', function() {
    const inputText = document.getElementById('inputText');
    const generateButton = document.getElementById('generateButton');
    const outputText = document.getElementById('outputText');
    const clearButton = document.getElementById('clearButton');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const copyTextButton = document.getElementById('copyTextButton');
    const copyMarkdownButton = document.getElementById('copyMarkdownButton');
    const statusCube = document.getElementById('statusCube');

    let eventSource = null;
    let accumulatedMarkdown = ''; // Store the accumulated markdown content
    let partialBuffer = ''; // Buffer for partial JSON chunks
    let isStreamComplete = false;

    // Configure marked options for security and features
    marked.setOptions({
        breaks: true, // Convert line breaks to <br>
        sanitize: false, // Don't sanitize HTML (renderer will handle this)
        smartLists: true, // Use smarter list behavior than default markdown
        smartypants: true, // Use smart typographic punctuation
    });

    // Function to create and show toast notifications
    function showToast(message, duration = 2000) {
        // Remove any existing toast
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }

        // Create and add new toast
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 10);

        // Hide and remove toast after duration
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Function to update status cube
    function updateStatusCube(status) {
        statusCube.className = `status-cube ${status}`;
    }

    // Event listeners for copy buttons
    copyTextButton.addEventListener('click', function() {
        if (!outputText.textContent.trim()) {
            showToast('No content to copy');
            return;
        }

        // Copy the plain text (without formatting)
        navigator.clipboard.writeText(outputText.textContent)
            .then(() => showToast('Text copied to clipboard'))
            .catch(err => {
                console.error('Failed to copy text: ', err);
                
                // Provide specific error messages for clipboard issues
                if (err.name === 'NotAllowedError') {
                    showToast('Clipboard access denied. Enable permissions or use HTTPS.');
                } else if (err.name === 'SecurityError') {
                    showToast('Clipboard blocked by security policy. Ensure HTTPS connection.');
                } else if (err.message.includes('secure context')) {
                    showToast('Clipboard requires secure context (HTTPS).');
                } else {
                    showToast('Failed to copy text - try manual copy');
                }
            });
    });

    copyMarkdownButton.addEventListener('click', function() {
        if (!accumulatedMarkdown.trim()) {
            showToast('No markdown content to copy');
            return;
        }

        // Copy the raw markdown
        navigator.clipboard.writeText(accumulatedMarkdown)
            .then(() => showToast('Markdown copied to clipboard'))
            .catch(err => {
                console.error('Failed to copy markdown: ', err);
                
                // Provide specific error messages for clipboard issues
                if (err.name === 'NotAllowedError') {
                    showToast('Clipboard access denied. Enable permissions or use HTTPS.');
                } else if (err.name === 'SecurityError') {
                    showToast('Clipboard blocked by security policy. Ensure HTTPS connection.');
                } else if (err.message.includes('secure context')) {
                    showToast('Clipboard requires secure context (HTTPS).');
                } else {
                    showToast('Failed to copy markdown - try manual copy');
                }
            });
    });

    generateButton.addEventListener('click', function() {
        const prompt = inputText.value;
        if (!prompt.trim()) {
            outputText.innerHTML = '<p>Please enter text before generating a response.</p>';
            return;
        }

        // Reset output area and accumulated markdown
        outputText.innerHTML = '';
        accumulatedMarkdown = '';
        partialBuffer = '';
        isStreamComplete = false;
        
        // Show loading spinner and set status cube to blue (loading)
        loadingSpinner.style.display = 'inline-block';
        generateButton.disabled = true;
        updateStatusCube('blue');

        // Close any existing connection
        if (eventSource) {
            eventSource.close();
        }

        // Using fetch initially to send the POST request with CSRF token
        fetch('/playground/zllm/generate_text_streaming/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({ prompt: prompt })
        })
        .then(response => {
            if (response.status === 429) {
                throw new Error('RATE_LIMIT_EXCEEDED');
            }
            if (response.status === 403) {
                throw new Error('Access forbidden (403): Authentication or permission issue');
            }
            if (response.status === 404) {
                throw new Error('Service not found (404): The streaming endpoint is not available');
            }
            if (response.status >= 500) {
                throw new Error(`Server error (${response.status}): The server is experiencing issues`);
            }
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
            }
            
            // Check if response is actually a stream
            if (!response.body) {
                throw new Error('Response does not support streaming');
            }
            
            // Process the streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8', { fatal: false });
            
            // Helper function to process complete JSON chunks
            function processJsonChunk(jsonData) {
                try {
                    if (jsonData.error) {
                        // Handle error responses
                        if (jsonData.error.includes('model requires more system memory') || 
                            jsonData.error.includes('The AI model requires more system memory')) {
                            accumulatedMarkdown += `**⚠️ Not enough memory**: Please try again with a shorter message or wait a moment.\n`;
                        } else {
                            accumulatedMarkdown += `Error: ${jsonData.error}\n`;
                        }
                        updateStatusCube('red');
                        return;
                    }
                    
                    // Handle done:false responses (streaming content)
                    if (jsonData.done === false && jsonData.response) {
                        accumulatedMarkdown += jsonData.response;
                        renderMarkdown(accumulatedMarkdown);
                    }
                    
                    // Handle done:true responses (completion metadata)
                    else if (jsonData.done === true) {
                        isStreamComplete = true;
                        
                        // Log completion statistics if available
                        if (jsonData.eval_count && jsonData.eval_duration) {
                            const tokensPerSecond = (jsonData.eval_count / (jsonData.eval_duration / 1000000000)).toFixed(1);
                            console.log(`Generation complete: ${jsonData.eval_count} tokens in ${(jsonData.eval_duration / 1000000000).toFixed(2)}s (${tokensPerSecond} tokens/s)`);
                        }
                        
                        // Final render and update status
                        renderMarkdown(accumulatedMarkdown);
                        updateStatusCube('green');
                        loadingSpinner.style.display = 'none';
                        generateButton.disabled = false;
                        return;
                    }
                    
                    // Fallback for other response formats
                    else if (jsonData.response || jsonData.token) {
                        accumulatedMarkdown += jsonData.response || jsonData.token || '';
                        renderMarkdown(accumulatedMarkdown);
                    }
                    
                } catch (e) {
                    console.error('Error processing JSON chunk:', e, jsonData);
                }
            }
            
            // Helper function to parse SSE data line
            function parseSSELine(line) {
                if (!line.startsWith('data:')) return null;
                
                const content = line.slice(5).trim();
                if (!content) return null;
                
                try {
                    return JSON.parse(content);
                } catch (e) {
                    console.error('Invalid JSON in SSE data:', e, content);
                    return null;
                }
            }
            
            // Start reading the stream
            function readStream() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        // Process any remaining buffer content
                        if (partialBuffer.trim()) {
                            const lines = partialBuffer.split('\n');
                            lines.forEach(line => {
                                if (line.trim()) {
                                    const jsonData = parseSSELine(line.trim());
                                    if (jsonData) processJsonChunk(jsonData);
                                }
                            });
                        }
                        
                        // Mark stream as complete if not already done
                        if (!isStreamComplete) {
                            loadingSpinner.style.display = 'none';
                            generateButton.disabled = false;
                            updateStatusCube('green');
                            renderMarkdown(accumulatedMarkdown);
                        }
                        return;
                    }
                    
                    // Decode the received chunk with proper UTF-8 handling
                    const chunk = decoder.decode(value, { stream: true });
                    
                    // Add chunk to partial buffer
                    partialBuffer += chunk;
                    
                    // Process complete SSE messages (ending with \n\n)
                    const messages = partialBuffer.split('\n\n');
                    
                    // Keep the last incomplete message in the buffer
                    partialBuffer = messages.pop() || '';
                    
                    // Process all complete messages
                    messages.forEach(message => {
                        if (message.trim()) {
                            const lines = message.split('\n');
                            lines.forEach(line => {
                                if (line.trim()) {
                                    const jsonData = parseSSELine(line.trim());
                                    if (jsonData) {
                                        processJsonChunk(jsonData);
                                        
                                        // Exit early if stream is marked complete
                                        if (isStreamComplete) return;
                                    }
                                }
                            });
                        }
                    });
                    
                    // Continue reading if not complete
                    if (!isStreamComplete) {
                        readStream();
                    }
                }).catch(error => {
                    loadingSpinner.style.display = 'none';
                    generateButton.disabled = false;
                    updateStatusCube('red');
                    
                    let errorMessage = '';
                    
                    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                        errorMessage = 'Network error during streaming: Connection lost or HTTPS/SSL issues detected.';
                    } else if (error.message.includes('SSL') || error.message.includes('certificate') || error.message.includes('TLS')) {
                        errorMessage = 'HTTPS/SSL streaming error: Security certificate problem detected.';
                    } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
                        errorMessage = 'Streaming timeout: Connection timed out while receiving data.';
                    } else if (error.message.includes('net::ERR_')) {
                        errorMessage = `Network error: ${error.message}`;
                    } else {
                        errorMessage = `Streaming error: ${error.message}`;
                    }
                    
                    accumulatedMarkdown += `\n\n**Error**: ${errorMessage}`;
                    renderMarkdown(accumulatedMarkdown);
                    console.error('Stream reading error:', error);
                    
                    // Show toast for critical streaming errors
                    if (error.name === 'TypeError' || error.message.includes('SSL') || error.message.includes('certificate')) {
                        showToast('Streaming connection error', 3000);
                    }
                });
            }
            
            readStream();
        })
        .catch(error => {
            console.error('Error:', error);
            loadingSpinner.style.display = 'none';
            generateButton.disabled = false;
            updateStatusCube('red');
            
            let errorMessage = '';
            
            if (error.message === 'RATE_LIMIT_EXCEEDED') {
                errorMessage = 'Rate limit exceeded. You can only send 5 messages per minute. Wait a few seconds before making another request.';
                // Disable the button for a minute
                generateButton.disabled = true;
                setTimeout(() => {
                    generateButton.disabled = false;
                }, 60000); // Re-enable after 1 minute
            } else if (error.message.includes('model requires more system memory') || error.message.includes('The AI model requires more system memory')) {
                errorMessage = 'Not enough memory: Please try again with a shorter message or wait a moment.';
            } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                errorMessage = 'Network error: Unable to connect to the server. This could be due to HTTPS/SSL certificate issues, network connectivity problems, or server downtime. Please check your connection and try again.';
            } else if (error.message.includes('SSL') || error.message.includes('certificate') || error.message.includes('TLS')) {
                errorMessage = 'HTTPS/SSL Error: There\'s a problem with the server\'s security certificate. This may be due to an expired certificate, self-signed certificate, or certificate mismatch. Please contact the administrator.';
            } else if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
                errorMessage = 'Cross-origin request blocked: The server may have CORS configuration issues or mixed content policies (HTTP/HTTPS mismatch).';
            } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
                errorMessage = 'Request timeout: The server took too long to respond. Please try again later.';
            } else if (error.message.includes('403')) {
                errorMessage = 'Access forbidden: You don\'t have permission to access this resource. Please check your authentication.';
            } else if (error.message.includes('404')) {
                errorMessage = 'Service not found: The requested service endpoint is not available. Please check the URL or contact support.';
            } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
                errorMessage = 'Server error: The server is experiencing issues. Please try again later.';
            } else if (error.message.includes('net::ERR_CERT_')) {
                errorMessage = 'Certificate error: The server\'s SSL certificate is invalid or expired. This is an HTTPS security issue that needs to be resolved by the server administrator.';
            } else if (error.message.includes('net::ERR_SSL_')) {
                errorMessage = 'SSL/TLS error: There\'s a problem establishing a secure connection. This could be due to outdated security protocols or certificate issues.';
            } else if (error.message.includes('net::ERR_CONNECTION_')) {
                errorMessage = 'Connection error: Unable to establish a connection to the server. Please check your internet connection and try again.';
            } else {
                errorMessage = `An unexpected error occurred: ${error.message}`;
            }
            
            outputText.innerHTML = `<p style="color: #e74c3c; padding: 10px; background-color: #fdf2f2; border-left: 4px solid #e74c3c; margin: 10px 0;">${errorMessage}</p>`;
            
            // Show toast notification for critical errors
            if (error.message.includes('SSL') || error.message.includes('certificate') || error.message.includes('TLS') || error.name === 'TypeError') {
                showToast('Connection error - check console for details', 4000);
            }
        });
    });

    // Function to render markdown content safely with performance optimizations
    let renderTimeout = null;
    let lastRenderedLength = 0;
    
    function renderMarkdown(markdown) {
        try {
            // Skip rendering if content hasn't changed significantly (for performance)
            if (markdown.length === lastRenderedLength) return;
            
            // Debounce rapid render calls during streaming
            if (renderTimeout) {
                clearTimeout(renderTimeout);
            }
            
            // Only render immediately if content has grown significantly or stream is complete
            const shouldRenderNow = isStreamComplete || 
                                  (markdown.length - lastRenderedLength) > 50 || 
                                  markdown.length < 100;
            
            if (shouldRenderNow) {
                doRender();
            } else {
                // Debounce frequent updates during active streaming
                renderTimeout = setTimeout(doRender, 100);
            }
            
            function doRender() {
                // Convert markdown to HTML with proper UTF-8 handling
                const html = marked.parse(markdown);
                outputText.innerHTML = html;
                lastRenderedLength = markdown.length;
                
                // Add syntax highlighting to code blocks if available
                const codeBlocks = outputText.querySelectorAll('pre code');
                if (window.hljs && codeBlocks.length > 0) {
                    codeBlocks.forEach(block => {
                        if (!block.dataset.highlighted) {
                            hljs.highlightElement(block);
                            block.dataset.highlighted = 'true';
                        }
                    });
                }
                
                // Clear the timeout
                renderTimeout = null;
            }
            
        } catch (error) {
            console.error('Error rendering markdown:', error);
            outputText.innerHTML = '<p style="color: #e74c3c;">Error rendering markdown content. The content may contain invalid characters or syntax.</p>';
        }
    }

    clearButton.addEventListener('click', function() {
        inputText.value = '';
        outputText.innerHTML = '';
        accumulatedMarkdown = '';
        partialBuffer = '';
        isStreamComplete = false;
        
        // Close any existing connection
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        
        // Reset UI and status cube
        loadingSpinner.style.display = 'none';
        generateButton.disabled = false;
        updateStatusCube('gray');
    });

    // Function to get CSRF token from cookies
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});