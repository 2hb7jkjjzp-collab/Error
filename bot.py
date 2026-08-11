from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "هلا 👋\n"
        "أنا بوتك التجريبي.\n"
        "أرسل لي أي رسالة وسأرد عليك."
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_message = update.message.text

    await update.message.reply_text(
        f"وصلتني رسالتك:\n\n{user_message}"
    )


def main():
    BOT_TOKEN = "ضع_توكن_البوت_هنا"

    application = Application.builder().token(BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start))

    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )

    print("Bot is running...")

    application.run_polling()


if __name__ == "__main__":
    main()