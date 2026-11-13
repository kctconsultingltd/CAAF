// Sends a message to the admin Telegram chat (TELEGRAM_BOT_TOKEN /
// TELEGRAM_CHAT_ID). Never throws: a failed notification must not break the
// job or request that triggered it.
export async function notifyTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('[telegram] Not configured: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing');
    return;
  }
  // Prod and staging share one chat, so each message says which one sent it.
  const envName = process.env.RAILWAY_ENVIRONMENT_NAME;
  const envLabel = envName ? '[' + envName + '] ' : '';
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: envLabel + message }),
    });
    if (res.ok) {
      console.log('[telegram] Message sent');
    } else {
      console.error('[telegram] Rejected message: ' + res.status + ' ' + (await res.text()));
    }
  } catch (err: any) {
    console.error('[telegram] Request failed: ' + err.message);
  }
}
