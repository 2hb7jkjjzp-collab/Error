import os

from openai import OpenAI
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)


# الاتصال بـ DeepSeek
client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url="https://api.deepseek.com",
)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "هلا 👋\n"
        "أنا مساعدك البرمجي.\n"
        "أرسل لي أي سؤال أو كود، وبساعدك."
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
            "صار خطأ أثناء الاتصال بـ DeepSeek.\n"
            "تأكد أن مفتاح DEEPSEEK_API_KEY موجود وصحيح."
        )


def main():
    bot_token = os.environ["BOT_TOKEN"]

    application = Application.builder().token(bot_token).build()

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