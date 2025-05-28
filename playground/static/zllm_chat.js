document.addEventListener('DOMContentLoaded', () => {
    const messageList = document.getElementById('message-list');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const loadingSpinner = document.getElementById('loading-spinner');
    const newChatButton = document.getElementById('new-chat-button');
    
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    let chatHistoryForAPI = []; // Stores {role: 'user'/'assistant', content: '...'}
    
    // Determine language from HTML lang attribute
    const htmlLang = document.documentElement.lang || 'en';
    
    const welcomeMessage_en = "## Welcome to ZLLM Chat! 👋\n\nHello! I'm **ZLLM**. How can I assist you today? Feel free to ask anything about me or general questions.\n\n*You can try asking about my features, capabilities, or any programming questions you might have.*";
    const welcomeMessage_pt_br = "## Bem-vindo ao ZLLM Chat! 👋\n\nOlá! Eu sou o **ZLLM**. Como posso ajudar você hoje? Sinta-se à vontade para perguntar qualquer coisa sobre mim ou questões gerais.\n\n*Você pode tentar perguntar sobre minhas funcionalidades, capacidades ou qualquer dúvida de programação que possa ter.*";

    let welcomeMessage;
    if (htmlLang.startsWith('pt')) {
        welcomeMessage = welcomeMessage_pt_br;
    } else {
        welcomeMessage = welcomeMessage_en;
    }

    // CSRF Token
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    const csrftoken = getCookie('csrftoken');

    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const targetTab = button.getAttribute('data-tab');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${targetTab}-tab`) {
                    content.classList.add('active');
                }
            });
        });
    });

    // New chat functionality
    function startNewChat() {
        messageList.innerHTML = ''; // Clear all messages
        chatHistoryForAPI = []; // Reset chat history
        addMessageToDisplay('assistant', welcomeMessage);
        
        // Switch to chat tab if not already active
        tabButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === 'chat') {
                btn.click();
            }
        });
        
        messageInput.value = '';
        adjustTextareaHeight();
        messageInput.focus();
    }

    newChatButton.addEventListener('click', startNewChat);

    // Configure marked options for markdown parsing
    marked.setOptions({
        breaks: true, // Add line breaks on single line breaks
        gfm: true,    // Use GitHub Flavored Markdown
        headerIds: false, // Don't add IDs to headers
        mangle: false // Don't mangle email addresses
    });

    function addMessageToDisplay(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        
        // Only render markdown for assistant messages
        if (role === 'assistant') {
            // Parse markdown and sanitize the resulting HTML
            const parsedContent = marked.parse(content);
            const sanitizedContent = DOMPurify.sanitize(parsedContent);
            
            // Create a container for the markdown content
            const contentContainer = document.createElement('div');
            contentContainer.classList.add('markdown-content');
            contentContainer.innerHTML = sanitizedContent;
            messageDiv.appendChild(contentContainer);
        } else {
            // For user messages, keep as plain text
            const contentParagraph = document.createElement('p');
            contentParagraph.textContent = content;
            messageDiv.appendChild(contentParagraph);
        }
        
        messageList.appendChild(messageDiv);
        // Ensure scroll to bottom of message list
        messageList.scrollTop = messageList.scrollHeight;
    }

    async function sendMessage() {
        const userMessageContent = messageInput.value.trim();
        if (!userMessageContent) return;

        addMessageToDisplay('user', userMessageContent);
        messageInput.value = '';
        adjustTextareaHeight(); // Reset textarea height

        // Save the original button text and replace with spinner
        const originalButtonText = sendButton.innerHTML;
        sendButton.innerHTML = '<div class="spinner"></div>';
        sendButton.disabled = true;

        try {
            const response = await fetch('/playground/zllm/chat/chat_with_zllm/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({
                    prompt: userMessageContent,
                    messages: chatHistoryForAPI, // Send history before current user message
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
                
                // Handle specific error types
                let errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
                
                if (response.status === 502) {
                    errorMessage = 'The AI service is temporarily unavailable. Please try again in a moment.';
                } else if (response.status === 408) {
                    errorMessage = 'Request timed out. The service might be busy. Please try again.';
                } else if (response.status >= 500) {
                    errorMessage = 'The AI service is experiencing issues. Please try again later.';
                } else if (response.status === 429) {
                    errorMessage = 'Too many requests. Please wait a moment before trying again.';
                }
                
                throw new Error(errorMessage);
            }

            const data = await response.json();
            const assistantResponseContent = data.response;

            if (assistantResponseContent) {
                addMessageToDisplay('assistant', assistantResponseContent);
                // Update API history
                chatHistoryForAPI.push({ role: 'user', content: userMessageContent });
                chatHistoryForAPI.push({ role: 'assistant', content: assistantResponseContent });
            } else {
                addMessageToDisplay('assistant', 'Sorry, I received an empty response.');
            }

        } catch (error) {
            console.error('Error sending message:', error);
            
            // Check if it's a network error
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                addMessageToDisplay('assistant', 'Network error: Please check your internet connection and try again.');
            } else {
                addMessageToDisplay('assistant', `**Error:** ${error.message}\n\n*You can try sending your message again.*`);
            }
        } finally {
            // Restore the original button text
            sendButton.innerHTML = originalButtonText;
            sendButton.disabled = false;
            messageInput.focus();
        }
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    // Auto-adjust textarea height
    function adjustTextareaHeight() {
        messageInput.style.height = 'auto'; // Reset height
        messageInput.style.height = (messageInput.scrollHeight) + 'px'; // Set to scroll height
    }
    messageInput.addEventListener('input', adjustTextareaHeight);
    
    // Initialize UI
    adjustTextareaHeight();
    
    // We don't automatically start a new chat on page load
    // This keeps the instructions tab as default
    // When user clicks on Chat tab or New Chat button, then we'll start a chat
    
    // Pre-load the welcome message for when user switches to chat
    const chatTab = document.querySelector('[data-tab="chat"]');
    chatTab.addEventListener('click', () => {
        // Only add welcome message if chat is empty
        if (messageList.children.length === 0) {
            addMessageToDisplay('assistant', welcomeMessage);
        }
    });
});
