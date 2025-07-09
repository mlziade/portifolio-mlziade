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
            const decoder = new TextDecoder();
            
            // Start reading the stream
            function readStream() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        // Stream is complete
                        loadingSpinner.style.display = 'none';
                        generateButton.disabled = false;
                        updateStatusCube('green');
                        
                        // Final render of complete markdown
                        renderMarkdown(accumulatedMarkdown);
                        return;
                    }
                    
                    // Decode the received chunk
                    const chunk = decoder.decode(value, { stream: true });
                    
                    // Process SSE format
                    const lines = chunk.split('\n\n');
                    lines.forEach(line => {
                        if (line.startsWith('data:')) {
                            try {
                                const content = line.slice(5).trim();
                                if (content) {
                                    const data = JSON.parse(content);
                                    if (data.error) {
                                        // Special handling for memory error
                                        if (data.error.includes('model requires more system memory') || 
                                            data.error.includes('The AI model requires more system memory')) {
                                            accumulatedMarkdown += `**⚠️ Not enough memory**: Please try again with a shorter message or wait a moment.\n`;
                                        } else {
                                            accumulatedMarkdown += `Error: ${data.error}\n`;
                                        }
                                        updateStatusCube('red');
                                    } else if (data.response) {
                                        accumulatedMarkdown += data.response;
                                    } else if (data.token) {
                                        accumulatedMarkdown += data.token;
                                    }
                                    
                                    // Update the display with the latest markdown
                                    renderMarkdown(accumulatedMarkdown);
                                }
                            } catch (e) {
                                console.error('Error parsing SSE data:', e);
                                // Try to handle plain text response
                                accumulatedMarkdown += line.slice(5).trim();
                                renderMarkdown(accumulatedMarkdown);
                            }
                        }
                    });
                    
                    // Continue reading
                    readStream();
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

    // Function to render markdown content safely
    function renderMarkdown(markdown) {
        try {
            // Convert markdown to HTML and set it to the output element
            outputText.innerHTML = marked.parse(markdown);
            
            // Add syntax highlighting to code blocks if needed
            const codeBlocks = outputText.querySelectorAll('pre code');
            if (window.hljs && codeBlocks.length > 0) {
                codeBlocks.forEach(block => {
                    hljs.highlightElement(block);
                });
            }
        } catch (error) {
            console.error('Error rendering markdown:', error);
            outputText.innerHTML = '<p>Error rendering markdown content.</p>';
        }
    }

    clearButton.addEventListener('click', function() {
        inputText.value = '';
        outputText.innerHTML = '';
        accumulatedMarkdown = '';
        
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