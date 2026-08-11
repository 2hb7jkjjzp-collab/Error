import os
import threading

from flask import Flask
from openai import OpenAI

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)


# =========================
# Render Web Server
# =========================

web_app = Flask(__name__)


@web_app.route("/")
def home():
    return "Bot is running!"


def run_web_server():
    port = int(os.environ.get("PORT", 10000))
    web_app.run(host="0.0.0.0", port=port)


# =========================
# DeepSeek
# =========================

client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url="https://api.deepseek.com",
)


# =========================
# Telegram
# =========================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "هلا 👋\n"
        "أنا مساعدك البرمجي.\n"
        "أرسل لي أي سؤال أو كود."
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):

    user_message = update.message.text

    try:

        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "أنت مساعد برمجي متخصص. "
                        "ساعد المستخدم في Python وGPC والـScripts والـAPIs "
                        "وتصحيح الأخطاء وكتابة الأكواد. "
                        "كن دقيقًا ومباشرًا."
                    ),
                },
                {
                    "role": "user",
                    "content": user_message,
                },
            ],
        )

        ai_reply = response.choices[0].message.content

        await update.message.reply_text(ai_reply)

    except Exception as e:

        print(f"DeepSeek Error: {e}")

        await update.message.reply_text(
            "صار خطأ أثناء الاتصال بـ DeepSeek."
        )


# =========================
# Main
# =========================

def main():

    # تشغيل Web Server في الخلفية
    threading.Thread(
        target=run_web_server,
        daemon=True
    ).start()

    bot_token = os.environ["BOT_TOKEN"]

    application = (
        Application.builder()
        .token(bot_token)
        .build()
    )

    application.add_handler(
        CommandHandler("start", start)
    )

    application.add_handler(
        MessageHandler(
            filters.TEXT & ~filters.COMMAND,
            handle_message
        )
    )

    print("Bot is running...")

    application.run_polling()


if __name__ == "__main__":
    main()