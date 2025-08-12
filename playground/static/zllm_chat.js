/**
 * Modern ZLLM Chat Interface - JavaScript
 * Inspired by OpenAI/Anthropic chat interfaces
 */

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elements = {
        // Sidebar
        sidebar: document.getElementById('sidebar'),
        sidebarToggle: document.getElementById('sidebar-toggle'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mobileSidebarToggle: document.getElementById('mobile-sidebar-toggle'),
        uncollapseButton: document.getElementById('uncollapse-button'),
        
        // Navigation
        resetButton: document.getElementById('reset-button'),
        instructionsButton: document.getElementById('instructions-button'),
        closeInstructions: document.getElementById('close-instructions'),
        
        // Chat
        chatContainer: document.getElementById('chat-container'),
        messagesList: document.getElementById('messages-list'),
        messageInput: document.getElementById('message-input'),
        sendButton: document.getElementById('send-button'),
        
        // Instructions
        instructionsPanel: document.getElementById('instructions-panel'),
        sampleQuestions: document.querySelectorAll('.sample-question')
    };

    // Application State
    const state = {
        chatHistory: [], // For API - stores {role: 'user'/'assistant', content: '...'}
        isLoading: false,
        sidebarCollapsed: false,
        isMobile: window.innerWidth <= 768
    };

    // Language Detection
    const language = document.documentElement.lang || 'en';
    const isPortuguese = language.startsWith('pt');

    // Welcome Messages
    const welcomeMessages = {
        en: "## Welcome to ZLLM Chat! 👋\n\nHello! I'm **ZLLM**, your AI assistant. I'm here to help answer questions, provide explanations, and assist with various tasks. How can I help you today?\n\n*Feel free to ask about my capabilities, programming concepts, or any questions you might have.*",
        pt: "## Bem-vindo ao ZLLM Chat! 👋\n\nOlá! Eu sou o **ZLLM**, seu assistente de IA. Estou aqui para ajudar a responder perguntas, fornecer explicações e auxiliar com várias tarefas. Como posso ajudar você hoje?\n\n*Sinta-se à vontade para perguntar sobre minhas capacidades, conceitos de programação ou qualquer dúvida que possa ter.*"
    };

    const welcomeMessage = isPortuguese ? welcomeMessages.pt : welcomeMessages.en;

    // CSRF Token
    function getCsrfToken() {
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
        return cookieValue || '';
    }

    // Initialize marked configuration
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false,
            mangle: false
        });
    }

    // Utility Functions
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function scrollToBottom(smooth = true) {
        const container = elements.messagesList.parentElement; // messages-container
        if (smooth) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            container.scrollTop = container.scrollHeight;
        }
    }

    function updateSendButtonState() {
        const hasText = elements.messageInput.value.trim().length > 0;
        elements.sendButton.disabled = !hasText || state.isLoading;
    }

    function adjustTextareaHeight() {
        elements.messageInput.style.height = 'auto';
        elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 128) + 'px';
    }

    // Message Creation Functions
    function createMessageElement(role, content) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', role);

        // Create avatar
        const avatar = document.createElement('div');
        avatar.classList.add('message-avatar');
        avatar.textContent = role === 'user' ? 'U' : 'AI';

        // Create content container
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        // Create message bubble
        const bubble = document.createElement('div');
        bubble.classList.add('message-bubble');

        if (role === 'assistant' && typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
            // Parse markdown and sanitize for assistant messages
            const parsedContent = marked.parse(content);
            const sanitizedContent = DOMPurify.sanitize(parsedContent);
            
            const markdownContainer = document.createElement('div');
            markdownContainer.classList.add('markdown-content');
            markdownContainer.innerHTML = sanitizedContent;
            bubble.appendChild(markdownContainer);
        } else {
            // Plain text for user messages
            const textElement = document.createElement('p');
            textElement.textContent = content;
            textElement.style.margin = '0';
            bubble.appendChild(textElement);
        }

        messageContent.appendChild(bubble);
        messageElement.appendChild(avatar);
        messageElement.appendChild(messageContent);

        return messageElement;
    }

    function addMessage(role, content) {
        const messageElement = createMessageElement(role, content);
        elements.messagesList.appendChild(messageElement);
        
        // Smooth scroll to the new message after a brief delay to allow for DOM updates
        requestAnimationFrame(() => {
            setTimeout(() => {
                scrollToBottom(true);
            }, 50);
        });
    }

    // Chat Functions
    function resetChat() {
        // Clear messages
        elements.messagesList.innerHTML = '';
        
        // Reset chat history
        state.chatHistory = [];
        
        // Add welcome message
        addMessage('assistant', welcomeMessage);
        
        // Focus input
        elements.messageInput.focus();
        
        // Close instructions if open
        hideInstructions();
    }

    function setLoadingState(loading) {
        state.isLoading = loading;
        
        if (loading) {
            elements.sendButton.classList.add('loading');
            elements.sendButton.innerHTML = '<div class="spinner"></div>';
            elements.messageInput.disabled = true;
        } else {
            elements.sendButton.classList.remove('loading');
            elements.sendButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22,2 15,22 11,13 2,9"/>
                </svg>
            `;
            elements.messageInput.disabled = false;
            elements.messageInput.focus();
        }
        
        updateSendButtonState();
    }

    async function sendMessage() {
        const userMessage = elements.messageInput.value.trim();
        if (!userMessage || state.isLoading) return;

        // Add user message to UI
        addMessage('user', userMessage);
        
        // Clear input and reset height
        elements.messageInput.value = '';
        adjustTextareaHeight();
        
        // Set loading state
        setLoadingState(true);

        try {
            const response = await fetch('/playground/zllm/chat/chat_with_zllm/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify({
                    prompt: userMessage,
                    messages: state.chatHistory,
                }),
            });

            if (!response.ok) {
                let errorMessage = 'An error occurred while sending your message.';
                
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // Use default error message
                }
                
                // Handle specific HTTP status codes
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
            const assistantResponse = data.response;

            if (assistantResponse) {
                // Add assistant message to UI
                addMessage('assistant', assistantResponse);
                
                // Update chat history
                state.chatHistory.push({ role: 'user', content: userMessage });
                state.chatHistory.push({ role: 'assistant', content: assistantResponse });
            } else {
                throw new Error('Received empty response from the server.');
            }

        } catch (error) {
            console.error('Error sending message:', error);
            
            let errorDisplay = error.message;
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorDisplay = 'Network error: Please check your internet connection and try again.';
            }
            
            addMessage('assistant', `**Error:** ${errorDisplay}\n\n*You can try sending your message again.*`);
        } finally {
            setLoadingState(false);
        }
    }

    // Sidebar Functions
    function toggleSidebar() {
        if (state.isMobile) {
            elements.sidebar.classList.toggle('open');
            elements.sidebarOverlay.classList.toggle('visible');
        } else {
            state.sidebarCollapsed = !state.sidebarCollapsed;
            elements.sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
            updateUncollapseButton();
        }
    }

    function updateUncollapseButton() {
        if (!state.isMobile && elements.uncollapseButton) {
            elements.uncollapseButton.classList.toggle('visible', state.sidebarCollapsed);
        }
    }

    function closeSidebar() {
        if (state.isMobile) {
            elements.sidebar.classList.remove('open');
            elements.sidebarOverlay.classList.remove('visible');
        }
    }

    // Instructions Functions
    function showInstructions() {
        elements.instructionsPanel.classList.add('visible');
    }

    function hideInstructions() {
        elements.instructionsPanel.classList.remove('visible');
    }

    function insertSampleQuestion(question) {
        elements.messageInput.value = question;
        adjustTextareaHeight();
        updateSendButtonState();
        elements.messageInput.focus();
        hideInstructions();
    }

    // Event Listeners
    
    // Sidebar toggle
    if (elements.sidebarToggle) {
        elements.sidebarToggle.addEventListener('click', toggleSidebar);
    }

    if (elements.mobileSidebarToggle) {
        elements.mobileSidebarToggle.addEventListener('click', toggleSidebar);
    }

    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.addEventListener('click', closeSidebar);
    }

    if (elements.uncollapseButton) {
        elements.uncollapseButton.addEventListener('click', toggleSidebar);
    }

    // Navigation buttons
    if (elements.resetButton) {
        elements.resetButton.addEventListener('click', resetChat);
    }

    if (elements.instructionsButton) {
        elements.instructionsButton.addEventListener('click', showInstructions);
    }

    if (elements.closeInstructions) {
        elements.closeInstructions.addEventListener('click', hideInstructions);
    }

    // Message input handling
    if (elements.messageInput) {
        elements.messageInput.addEventListener('input', () => {
            adjustTextareaHeight();
            updateSendButtonState();
        });

        elements.messageInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });

        // Auto-focus on page load
        elements.messageInput.focus();
    }

    // Send button
    if (elements.sendButton) {
        elements.sendButton.addEventListener('click', sendMessage);
    }

    // Sample questions
    elements.sampleQuestions.forEach(button => {
        button.addEventListener('click', () => {
            const question = button.getAttribute('data-question');
            if (question) {
                insertSampleQuestion(question);
            }
        });
    });

    // Window resize handling
    const handleResize = debounce(() => {
        const wasMobile = state.isMobile;
        state.isMobile = window.innerWidth <= 768;
        
        // If switching from mobile to desktop, close mobile sidebar
        if (wasMobile && !state.isMobile) {
            closeSidebar();
        }
        
        // If switching from desktop to mobile, reset sidebar collapsed state
        if (!wasMobile && state.isMobile) {
            elements.sidebar.classList.remove('collapsed');
            state.sidebarCollapsed = false;
            updateUncollapseButton();
        }
        
        // Update uncollapse button visibility
        updateUncollapseButton();
    }, 250);

    window.addEventListener('resize', handleResize);

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        // Escape key to close instructions
        if (event.key === 'Escape') {
            hideInstructions();
            if (state.isMobile) {
                closeSidebar();
            }
        }
        
        // Ctrl/Cmd + K to focus input
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            elements.messageInput.focus();
        }
        
        // Ctrl/Cmd + R to reset chat
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            resetChat();
        }
    });

    // Initialize
    function init() {
        // Set initial state
        updateSendButtonState();
        adjustTextareaHeight();
        updateUncollapseButton();
        
        // Check if we should show welcome message
        if (elements.messagesList.children.length === 0) {
            addMessage('assistant', welcomeMessage);
        }
        
        // Focus input
        elements.messageInput.focus();
    }

    // Start the application
    init();
});