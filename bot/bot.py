#!/usr/bin/env python3
"""
PhishBOT — Telegram Phishing Detection Bot
Scans URLs and text messages via the PhishBOT backend API.

Usage:
  1. Set environment variables (see .env.example)
  2. pip install -r requirements.txt
  3. python bot.py
"""

import os
import re
import logging
import asyncio
import aiohttp
from datetime import datetime
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ContextTypes, filters
)

# ── Configuration ─────────────────────────────────────────────────────────────

TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN', '')
API_BASE_URL   = os.getenv('API_BASE_URL', 'http://localhost:3001')
ADMIN_IDS      = set(int(x) for x in os.getenv('ADMIN_IDS', '').split(',') if x.strip())
AUTO_SCAN      = os.getenv('AUTO_SCAN', 'true').lower() == 'true'

logging.basicConfig(
    format='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
    level=logging.INFO
)
log = logging.getLogger('PhishBOT')

# ── Verdict helpers ───────────────────────────────────────────────────────────

VERDICT_EMOJI  = { 'clean': '✅', 'suspicious': '⚠️', 'phishing': '🚨' }
VERDICT_COLOUR = { 'clean': 'GREEN', 'suspicious': 'ORANGE', 'phishing': 'RED' }

def verdict_badge(verdict: str, score: int) -> str:
    e = VERDICT_EMOJI.get(verdict, '❓')
    return f"{e} *{verdict.upper()}* (score: {score}/100)"

def signals_text(signals: list) -> str:
    if not signals:
        return '_No threat signals detected_'
    lines = []
    for s in signals[:8]:
        pts  = s.get('score', 0)
        icon = '🔴' if pts >= 30 else '🟡' if pts >= 15 else '🟢'
        lines.append(f"{icon} `{s['signal']}` (+{pts})")
    if len(signals) > 8:
        lines.append(f'_...and {len(signals) - 8} more signals_')
    return '\n'.join(lines)

# ── API client ────────────────────────────────────────────────────────────────

async def api_scan(text: str, input_type: str = 'auto', source: str = None) -> dict | None:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{API_BASE_URL}/api/scan',
                json={ 'input': text, 'type': input_type, 'source': source },
                timeout=aiohttp.ClientTimeout(total=10)
            ) as r:
                return await r.json()
    except Exception as e:
        log.error(f'Scan API error: {e}')
        return None

async def api_add_keyword(keyword: str, category: str = 'general', severity: str = 'medium') -> dict | None:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{API_BASE_URL}/api/keywords',
                json={ 'keyword': keyword, 'category': category, 'severity': severity },
                timeout=aiohttp.ClientTimeout(total=10)
            ) as r:
                return await r.json()
    except Exception as e:
        log.error(f'Keyword API error: {e}')
        return None

async def api_list_keywords(limit: int = 20) -> list:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f'{API_BASE_URL}/api/keywords',
                timeout=aiohttp.ClientTimeout(total=10)
            ) as r:
                data = await r.json()
                return data.get('keywords', [])[:limit]
    except Exception as e:
        log.error(f'Keyword list error: {e}')
        return []

async def api_summary() -> dict | None:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f'{API_BASE_URL}/api/logs/summary',
                timeout=aiohttp.ClientTimeout(total=10)
            ) as r:
                return await r.json()
    except Exception as e:
        log.error(f'Summary API error: {e}')
        return None

# ── Command handlers ──────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = (
        "🎣 *PhishBOT* — Real-time Phishing Detector\n\n"
        "Send me any *URL*, *email body*, or *suspicious text* and I'll analyse it instantly.\n\n"
        "*Commands:*\n"
        "/scan `<url or text>` — Scan specific input\n"
        "/stats — Detection statistics\n"
        "/keywords — List active keywords\n"
        "/addkeyword — Add a keyword (admin)\n"
        "/help — Show this message\n\n"
        "_Auto-scan is enabled: I'll check every message automatically._"
    )
    await update.message.reply_text(text, parse_mode='Markdown')

async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await cmd_start(update, ctx)

async def cmd_scan(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text(
            '⚠️ Usage: `/scan <url or text>`', parse_mode='Markdown'
        )
        return
    input_text = ' '.join(ctx.args)
    await _do_scan(update, input_text, 'auto', 'telegram-command')

async def cmd_stats(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    summary = await api_summary()
    if not summary:
        await update.message.reply_text('❌ Could not fetch stats. Is the API running?')
        return

    verdicts = { v['verdict']: v['count'] for v in summary.get('verdicts', []) }
    top_kw   = summary.get('topKeywords', [])

    lines = [
        '📊 *PhishBOT Statistics*\n',
        f"🚨 Phishing:   `{verdicts.get('phishing', 0)}`",
        f"⚠️  Suspicious: `{verdicts.get('suspicious', 0)}`",
        f"✅ Clean:      `{verdicts.get('clean', 0)}`\n",
        '*Top Triggered Keywords:*',
    ]
    for kw in top_kw[:5]:
        lines.append(f"  • `{kw['keyword']}` — {kw['hits']} hits [{kw['severity']}]")

    await update.message.reply_text('\n'.join(lines), parse_mode='Markdown')

async def cmd_keywords(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    keywords = await api_list_keywords(25)
    if not keywords:
        await update.message.reply_text('No keywords found.')
        return

    sev_icon = { 'low': '🟢', 'medium': '🟡', 'high': '🔴', 'critical': '💀' }
    lines = ['🔑 *Active Keywords* (top 25 by hits)\n']
    for kw in keywords:
        icon = sev_icon.get(kw['severity'], '❓')
        lines.append(f"{icon} `{kw['keyword']}` [{kw['category']}] — {kw['hits']} hits")

    await update.message.reply_text('\n'.join(lines), parse_mode='Markdown')

async def cmd_addkeyword(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    uid = update.effective_user.id
    if ADMIN_IDS and uid not in ADMIN_IDS:
        await update.message.reply_text('⛔ Admin only.')
        return

    # Format: /addkeyword <keyword> [category] [severity]
    if not ctx.args:
        await update.message.reply_text(
            'Usage: `/addkeyword <keyword> [category] [low|medium|high|critical]`',
            parse_mode='Markdown'
        )
        return

    keyword  = ctx.args[0]
    category = ctx.args[1] if len(ctx.args) > 1 else 'general'
    severity = ctx.args[2] if len(ctx.args) > 2 else 'medium'

    result = await api_add_keyword(keyword, category, severity)
    if not result:
        await update.message.reply_text('❌ API error. Could not add keyword.')
        return

    results = result.get('results', [])
    if results and results[0].get('status') == 'added':
        await update.message.reply_text(
            f"✅ Keyword added: `{keyword}` [{category}] [{severity}]",
            parse_mode='Markdown'
        )
    else:
        await update.message.reply_text(f"⚠️ Keyword `{keyword}` already exists.", parse_mode='Markdown')

# ── Auto-scan handler ─────────────────────────────────────────────────────────

URL_RE = re.compile(r'https?://[^\s<>"\']+|www\.[^\s<>"\']+', re.IGNORECASE)

async def auto_scan_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not AUTO_SCAN or not update.message or not update.message.text:
        return

    text = update.message.text.strip()
    urls = URL_RE.findall(text)

    if urls:
        # Scan first URL found
        await _do_scan(update, urls[0], 'url', 'telegram-auto')
    elif len(text) > 30:
        # Scan longer messages as text
        await _do_scan(update, text, 'text', 'telegram-auto')

async def _do_scan(update: Update, input_text: str, input_type: str, source: str):
    msg = await update.message.reply_text('🔍 Scanning...', parse_mode='Markdown')

    result = await api_scan(input_text, input_type, source)
    if not result:
        await msg.edit_text('❌ Scan failed. Backend unreachable.')
        return

    verdict   = result.get('verdict', 'unknown')
    score     = result.get('score', 0)
    signals   = result.get('signals', [])
    matched   = result.get('matchedKw', [])
    scan_id   = result.get('id', '-')

    text_lines = [
        f"🎣 *PhishBOT Analysis*\n",
        f"*Input:* `{input_text[:80]}{'...' if len(input_text) > 80 else ''}`",
        f"*Type:* `{result.get('inputType', input_type)}`",
        f"*Verdict:* {verdict_badge(verdict, score)}\n",
        '*Signals:*',
        signals_text(signals),
    ]

    if matched:
        text_lines.append(f'\n*Matched Keywords:* {", ".join(f"`{k}`" for k in matched[:5])}')

    text_lines.append(f'\n_Scan ID: {scan_id[:8]}_')

    # Inline button for suspicious/phishing
    keyboard = None
    if verdict in ('suspicious', 'phishing'):
        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton('📋 Full Report', callback_data=f'report:{scan_id}'),
            InlineKeyboardButton('✅ Mark Safe',   callback_data=f'safe:{scan_id}'),
        ]])

    await msg.edit_text(
        '\n'.join(text_lines),
        parse_mode='Markdown',
        reply_markup=keyboard,
    )

async def callback_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query  = update.callback_query
    await query.answer()
    action, scan_id = query.data.split(':', 1)

    if action == 'report':
        await query.message.reply_text(
            f'🔗 View full report in the PhishBOT Dashboard.\n_Scan ID: `{scan_id}`_',
            parse_mode='Markdown'
        )
    elif action == 'safe':
        await query.edit_message_reply_markup(None)
        await query.message.reply_text(
            '✅ Marked as safe. The input has been noted.',
            parse_mode='Markdown'
        )

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not TELEGRAM_TOKEN:
        log.error('TELEGRAM_TOKEN not set. Copy .env.example → .env and configure.')
        return

    app = Application.builder().token(TELEGRAM_TOKEN).build()

    app.add_handler(CommandHandler('start',       cmd_start))
    app.add_handler(CommandHandler('help',        cmd_help))
    app.add_handler(CommandHandler('scan',        cmd_scan))
    app.add_handler(CommandHandler('stats',       cmd_stats))
    app.add_handler(CommandHandler('keywords',    cmd_keywords))
    app.add_handler(CommandHandler('addkeyword',  cmd_addkeyword))
    app.add_handler(CallbackQueryHandler(callback_handler))

    if AUTO_SCAN:
        app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, auto_scan_handler))

    log.info('PhishBOT is running…')
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
