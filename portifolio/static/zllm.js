document.addEventListener('DOMContentLoaded', function() {
    const inputText = document.getElementById('inputText');
    const generateButton = document.getElementById('generateButton');
    const outputText = document.getElementById('outputText');
    const clearButton = document.getElementById('clearButton');
    const loadingSpinner = document.getElementById('loadingSpinner');

    generateButton.addEventListener('click', function() {
        const prompt = inputText.value;

        // Show loading spinner
        loadingSpinner.style.display = 'inline-block';
        generateButton.disabled = true; // Disable the button while loading

        fetch('/portifolio/projects/zllm/generate_text/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')  // Include CSRF token
            },
            body: JSON.stringify({ prompt: prompt })
        })
        .then(response => {
            if (response.status === 429) {
                throw new Error('RATE_LIMIT_EXCEEDED');
            } else if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Hide loading spinner
            loadingSpinner.style.display = 'none';
            generateButton.disabled = false; // Re-enable the button
            console.log(data); // Log the response data for debugging
            if (data.hasOwnProperty('response')) {
                outputText.textContent = data.response;
            } else if (data.hasOwnProperty('error')) {
                outputText.textContent = `Error: ${data.error}`;
            } else {
                outputText.textContent = 'Unexpected response format.';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            // Hide loading spinner
            loadingSpinner.style.display = 'none';
            generateButton.disabled = false; // Re-enable the button
            
            if (error.message === 'RATE_LIMIT_EXCEEDED') {
                outputText.textContent = 'Rate limit exceeded. You can only send 5 messages per minute. Wait a few seconds before making another request.';
                // Optionally disable the button for a minute
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