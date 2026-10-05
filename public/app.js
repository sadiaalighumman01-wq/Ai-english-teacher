// State management
let isTtsEnabled = true;
let isListening = false;
let recognition = null;
const sessionId = 'student_' + Math.random().toString(36).substring(2, 9);

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const ttsToggleBtn = document.getElementById('ttsToggleBtn');
const newChatBtn = document.getElementById('newChatBtn');

// Base API URL: Works whether opened via http://localhost:5000 or directly via file://
const API_BASE = (window.location.protocol === 'file:' || !window.location.port) ? 'http://127.0.0.1:5000' : '';

// Auto resize textarea
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = (userInput.scrollHeight) + 'px';
});

// Handle Enter to send (Shift+Enter for newline)
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

// Toggle TTS Voice
ttsToggleBtn.addEventListener('click', () => {
    isTtsEnabled = !isTtsEnabled;
    ttsToggleBtn.classList.toggle('active', isTtsEnabled);
    if (!isTtsEnabled) {
        window.speechSynthesis.cancel();
    }
});

// Reset Chat
newChatBtn.addEventListener('click', async () => {
    if (confirm('Start a fresh new lesson? (Naya sabaq shuru karein?)')) {
        chatContainer.innerHTML = '';
        window.speechSynthesis.cancel();
        
        await fetch(`${API_BASE}/api/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });

        appendTeacherMessage("Assalam-o-Alaikum! Ready for a fresh start. What would you like to practice today?");
    }
});

// Quick Prompt click
window.useQuickPrompt = function(promptText) {
    userInput.value = promptText;
    sendMessage();
};

// Send Message logic
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Display user message
    appendUserMessage(text);
    userInput.value = '';
    userInput.style.height = 'auto';

    // Show typing indicator
    const typingElem = showTypingIndicator();

    try {
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                sessionId: sessionId
            })
        });

        const data = await response.json();
        removeTypingIndicator(typingElem);

        if (data.status === 'success') {
            appendTeacherMessage(data.reply);
            if (isTtsEnabled) {
                speakRawText(data.reply);
            }
        } else {
            appendTeacherMessage("I am having a little trouble connecting. Please try again! Error: " + (data.error || 'Unknown'));
        }
    } catch (err) {
        removeTypingIndicator(typingElem);
        appendTeacherMessage("Could not reach the server. Please make sure the app server is running!");
    }
}

// Render Messages
function appendUserMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message user-msg';
    msgDiv.innerHTML = `
        <div class="msg-avatar">🧑‍🎓</div>
        <div class="msg-bubble">
            <div class="msg-header">You</div>
            <div class="msg-text">${escapeHtml(text)}</div>
        </div>
    `;
    chatContainer.appendChild(msgDiv);
    scrollToBottom();
}

function appendTeacherMessage(markdownText) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message teacher-msg';

    const formattedText = formatMarkdown(markdownText);

    msgDiv.innerHTML = `
        <div class="msg-avatar">👩‍🏫</div>
        <div class="msg-bubble">
            <div class="msg-header">Miss Sarah</div>
            <div class="msg-text">${formattedText}</div>
            <button class="speak-btn" onclick="speakFromElement(this)"><i class="fa-solid fa-volume-high"></i> Listen</button>
        </div>
    `;
    chatContainer.appendChild(msgDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message teacher-msg typing-msg';
    typingDiv.innerHTML = `
        <div class="msg-avatar">👩‍🏫</div>
        <div class="msg-bubble">
            <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        </div>
    `;
    chatContainer.appendChild(typingDiv);
    scrollToBottom();
    return typingDiv;
}

function removeTypingIndicator(elem) {
    if (elem && elem.parentNode) {
        elem.parentNode.removeChild(elem);
    }
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Markdown Formatter (Lightweight)
function formatMarkdown(text) {
    let clean = escapeHtml(text);
    // Bold
    clean = clean.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    clean = clean.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Line breaks
    clean = clean.replace(/\n\n/g, '<br><br>');
    clean = clean.replace(/\n/g, '<br>');
    return clean;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Text-to-Speech (TTS)
function speakRawText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Stop prior audio

    // Filter out symbols / asterisks for smooth speech
    const cleanSpeech = text.replace(/[*#_~]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.rate = 0.95; // slightly slower for educational clarity
    utterance.pitch = 1.05; // warm female pitch

    // Try finding an English female voice
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Google US English')));
    if (femaleVoice) {
        utterance.voice = femaleVoice;
    }

    window.speechSynthesis.speak(utterance);
}

window.speakFromElement = function(buttonElem) {
    const bubble = buttonElem.closest('.msg-bubble');
    const textElem = bubble.querySelector('.msg-text');
    if (textElem) {
        speakRawText(textElem.innerText);
    }
};

window.speakText = function(btn) {
    window.speakFromElement(btn);
};

// Speech-to-Text (Microphone)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        micBtn.classList.add('listening');
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopListening();
    };

    recognition.onend = () => {
        stopListening();
    };

    micBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch (e) {
                console.error(e);
            }
        }
    });
} else {
    micBtn.title = "Microphone not supported on this browser (Use Chrome or Edge)";
    micBtn.style.opacity = "0.5";
}

function stopListening() {
    isListening = false;
    micBtn.classList.remove('listening');
}

// Preload voices
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}
