document.addEventListener('DOMContentLoaded', function() {
    const inputText = document.getElementById('inputText');
    const generateButton = document.getElementById('generateButton');
    const outputText = document.getElementById('outputText');
    const clearButton = document.getElementById('clearButton');
    const loadingSpinner = document.getElementById('loadingSpinner');

    let eventSource = null;

    generateButton.addEventListener('click', function() {
        const prompt = inputText.value;
        if (!prompt.trim()) {
            outputText.textContent = 'Please enter text before generating a response.';
            return;
        }

        // Reset output area
        outputText.textContent = '';
        
        // Show loading spinner and disable button
        loadingSpinner.style.display = 'inline-block';
        generateButton.disabled = true;

        // Close any existing connection
        if (eventSource) {
            eventSource.close();
        }

        // Create new EventSource connection for streaming
        const csrftoken = getCookie('csrftoken');
        
        // Using fetch initially to send the POST request with CSRF token
        fetch('/playground/zllm/generate_text_streaming/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
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
                                        outputText.textContent += `Error: ${data.error}\n`;
                                    } else if (data.response) {
                                        outputText.textContent += data.response;
                                    } else if (data.token) {
                                        outputText.textContent += data.token;
                                    }
                                }
                            } catch (e) {
                                console.error('Error parsing SSE data:', e);
                                // Try to handle plain text response
                                outputText.textContent += line.slice(5).trim();
                            }
                        }
                    });
                    
                    // Continue reading
                    readStream();
                }).catch(error => {
                    loadingSpinner.style.display = 'none';
                    generateButton.disabled = false;
                    outputText.textContent += `\nError: ${error.message}`;
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
                outputText.textContent = 'Rate limit exceeded. You can only send 5 messages per minute. Wait a few seconds before making another request.';
                // Disable the button for a minute
                generateButton.disabled = true;
                setTimeout(() => {
                    generateButton.disabled = false;
                }, 60000); // Re-enable after 1 minute
            } else {
                outputText.textContent = `An error occurred: ${error.message}`;
            }
        });
    });

    clearButton.addEventListener('click', function() {
        inputText.value = '';
        outputText.textContent = '';
        
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