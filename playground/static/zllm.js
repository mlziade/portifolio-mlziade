document.addEventListener('DOMContentLoaded', function() {
    const inputText = document.getElementById('inputText');
    const generateButton = document.getElementById('generateButton');
    const outputText = document.getElementById('outputText');
    const clearButton = document.getElementById('clearButton');
    const loadingSpinner = document.getElementById('loadingSpinner');

    let eventSource = null;
    let accumulatedMarkdown = ''; // Store the accumulated markdown content

    // Configure marked options for security and features
    marked.setOptions({
        breaks: true, // Convert line breaks to <br>
        sanitize: false, // Don't sanitize HTML (renderer will handle this)
        smartLists: true, // Use smarter list behavior than default markdown
        smartypants: true, // Use smart typographic punctuation
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
        
        // Show loading spinner
        loadingSpinner.style.display = 'inline-block';
        generateButton.disabled = true;

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
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
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
                                        accumulatedMarkdown += `Error: ${data.error}\n`;
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
                    accumulatedMarkdown += `\nError: ${error.message}`;
                    renderMarkdown(accumulatedMarkdown);
                    console.error('Stream reading error:', error);
                });
            }
            
            readStream();
        })
        .catch(error => {
            console.error('Error:', error);
            loadingSpinner.style.display = 'none';
            generateButton.disabled = false;
            
            if (error.message === 'RATE_LIMIT_EXCEEDED') {
                outputText.innerHTML = '<p>Rate limit exceeded. You can only send 5 messages per minute. Wait a few seconds before making another request.</p>';
                // Disable the button for a minute
                generateButton.disabled = true;
                setTimeout(() => {
                    generateButton.disabled = false;
                }, 60000); // Re-enable after 1 minute
            } else {
                outputText.innerHTML = `<p>An error occurred: ${error.message}</p>`;
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
        
        // Reset UI
        loadingSpinner.style.display = 'none';
        generateButton.disabled = false;
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