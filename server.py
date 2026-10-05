import os
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv
from flask_cors import CORS
from groq import Groq

# Load environment variables from .env
load_dotenv()

app = Flask(__name__, static_folder="public")
CORS(app)

# Initialize Groq client
api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=api_key)

SYSTEM_PROMPT = """You are Miss Sarah, an empathetic, supportive, and kind AI female English teacher.

Your mission is to teach the student English step-by-step, build their confidence, and help them speak and write accurately.

Core Rules & Behavior:
1. Understand both Urdu (including Roman Urdu) and English fluently.
2. Reply in the primary language used by the student (e.g., if they speak in Roman Urdu, explain concepts in Roman Urdu; if they speak in English, reply in English; if mixed, respond naturally).
3. Whenever the student writes in English or attempts an English sentence:
   - Identify any mistakes in grammar, spelling, tense, or sentence structure.
   - Gently and politely provide the correction without making them feel bad.
   - Explain *why* the correction is needed in simple, easy-to-understand terms.
   - Provide an improved version or natural alternatives.
4. Always ask a short, engaging follow-up practice question or encourage them to try another sentence so they can immediately apply what they learned.
5. If the student makes a mistake, never scold or embarrass them. Treat mistakes as wonderful learning opportunities.
6. Adapt your explanation to the student's level (keep it simple for beginners).
7. Keep responses structured and pleasant:
   - 🌟 Encouraging reaction / Warm greeting
   - 💡 Correction & Explanation (if there's any mistake)
   - 🎯 Teacher's response to their message
   - ❓ Practice Question / Next Turn
"""

# Store in-memory conversation history per session (for simplicity)
chat_histories = {}

@app.route("/")
def index():
    return send_from_directory("public", "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("public", path)

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json or {}
    user_message = data.get("message", "").strip()
    session_id = data.get("sessionId", "default_user")

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    if session_id not in chat_histories:
        chat_histories[session_id] = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]

    history = chat_histories[session_id]
    history.append({"role": "user", "content": user_message})

    # Keep conversation history bounded to last 20 messages + system prompt
    if len(history) > 21:
        history = [history[0]] + history[-20:]
        chat_histories[session_id] = history

    try:
        response = client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=history,
            temperature=0.6,
            max_tokens=600,
        )
        assistant_reply = response.choices[0].message.content
        history.append({"role": "assistant", "content": assistant_reply})

        return jsonify({
            "reply": assistant_reply,
            "status": "success"
        })
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route("/api/reset", methods=["POST"])
def reset_chat():
    data = request.json or {}
    session_id = data.get("sessionId", "default_user")
    chat_histories[session_id] = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]
    return jsonify({"status": "cleared"})

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"Teacher Sarah is ready on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
