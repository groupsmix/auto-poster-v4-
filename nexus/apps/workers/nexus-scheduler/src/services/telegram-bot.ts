// ============================================================
// Telegram Bot Service
// Inbox Capture Bot — Zero-friction intake
// Commands: /note, /task, /idea
// ============================================================

import type { SchedulerEnv } from "../index";

export interface TelegramUpdate {
  message?: {
    message_id: number;
    from: {
      id: number;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

export class TelegramBot {
  private apiUrl: string;
  
  constructor(private env: SchedulerEnv) {
    this.apiUrl = env.TELEGRAM_BOT_TOKEN 
      ? `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`
      : '';
  }

  // Handle incoming webhook update
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (!update.message?.text) return;
    
    const chatId = update.message.chat.id;
    const text = update.message.text;
    const username = update.message.from.username || 'unknown';
    
    console.log(`[TELEGRAM] Message from @${username}: ${text.slice(0, 50)}...`);
    
    // Parse command
    if (text.startsWith('/start')) {
      await this.sendWelcome(chatId);
      return;
    }
    
    if (text.startsWith('/note ')) {
      await this.handleNote(chatId, text.slice(6));
      return;
    }
    
    if (text.startsWith('/task ')) {
      await this.handleTask(chatId, text.slice(6));
      return;
    }
    
    if (text.startsWith('/idea ')) {
      await this.handleIdea(chatId, text.slice(6));
      return;
    }
    
    if (text.startsWith('/help')) {
      await this.sendHelp(chatId);
      return;
    }
    
    // Default: treat as note
    await this.handleNote(chatId, text);
  }

  // Handle /note command
  private async handleNote(chatId: number, content: string): Promise<void> {
    // Extract using AI (simplified - would call nexus-ai)
    const extracted = await this.extractWithAI(content, 'note');
    
    // Store in D1
    const noteId = crypto.randomUUID();
    await this.env.DB.prepare(`
      INSERT INTO inbox_items (id, source, source_id, type, raw_content, extracted_data, created_at)
      VALUES (?, 'telegram', ?, 'note', ?, ?, ?)
    `).bind(
      noteId,
      chatId.toString(),
      content,
      JSON.stringify(extracted),
      new Date().toISOString()
    ).run();
    
    // Create job for processing
    await this.createInboxJob(noteId, 'note', extracted);
    
    await this.sendMessage(chatId, 
      `✅ Note captured!\n\n` +
      `Extracted:\n` +
      `• Title: ${extracted.title || 'N/A'}\n` +
      `• Category: ${extracted.category || 'Uncategorized'}\n` +
      `• Priority: ${extracted.priority || 'normal'}\n\n` +
      `ID: \`${noteId.slice(0, 8)}\``
    );
  }

  // Handle /task command
  private async handleTask(chatId: number, content: string): Promise<void> {
    const extracted = await this.extractWithAI(content, 'task');
    
    const taskId = crypto.randomUUID();
    await this.env.DB.prepare(`
      INSERT INTO inbox_items (id, source, source_id, type, raw_content, extracted_data, created_at)
      VALUES (?, 'telegram', ?, 'task', ?, ?, ?)
    `).bind(
      taskId,
      chatId.toString(),
      content,
      JSON.stringify(extracted),
      new Date().toISOString()
    ).run();
    
    await this.createInboxJob(taskId, 'task', extracted);
    
    await this.sendMessage(chatId,
      `✅ Task created!\n\n` +
      `• Task: ${extracted.title}\n` +
      `• Due: ${extracted.due_date || 'Not specified'}\n` +
      `• Priority: ${extracted.priority || 'normal'}\n\n` +
      `ID: \`${taskId.slice(0, 8)}\``
    );
  }

  // Handle /idea command
  private async handleIdea(chatId: number, content: string): Promise<void> {
    const extracted = await this.extractWithAI(content, 'idea');
    
    const ideaId = crypto.randomUUID();
    await this.env.DB.prepare(`
      INSERT INTO inbox_items (id, source, source_id, type, raw_content, extracted_data, created_at)
      VALUES (?, 'telegram', ?, 'idea', ?, ?, ?)
    `).bind(
      ideaId,
      chatId.toString(),
      content,
      JSON.stringify(extracted),
      new Date().toISOString()
    ).run();
    
    await this.createInboxJob(ideaId, 'idea', extracted);
    
    await this.sendMessage(chatId,
      `💡 Idea captured!\n\n` +
      `• Idea: ${extracted.title}\n` +
      `• Potential: ${extracted.potential || 'unknown'}\n` +
      `• Suggested niche: ${extracted.suggested_niche || 'Uncategorized'}\n\n` +
      `This will be reviewed for product potential.\n` +
      `ID: \`${ideaId.slice(0, 8)}\``
    );
  }

  // Extract structured data using AI
  private async extractWithAI(content: string, type: string): Promise<Record<string, unknown>> {
    // In production, this would call nexus-ai worker
    // For now, do simple extraction
    
    const lines = content.split('\n');
    const firstLine = lines[0].trim();
    
    const result: Record<string, unknown> = {
      title: firstLine.slice(0, 100),
      full_text: content,
      type: type,
    };
    
    // Simple keyword extraction
    if (content.match(/urgent|asap|important|critical/i)) {
      result.priority = 'high';
    } else if (content.match(/low priority|whenever|someday/i)) {
      result.priority = 'low';
    } else {
      result.priority = 'normal';
    }
    
    // Category detection
    const categories = {
      product: /product|item|sell|price|$/i,
      marketing: /marketing|promo|ad|campaign/i,
      content: /blog|post|article|video/i,
      tech: /bug|feature|code|api/i,
    };
    
    for (const [cat, regex] of Object.entries(categories)) {
      if (regex.test(content)) {
        result.category = cat;
        break;
      }
    }
    
    // Due date detection
    const dateMatch = content.match(/(tomorrow|next week|by \w+|\d{1,2}\/\d{1,2})/i);
    if (dateMatch) {
      result.due_date = dateMatch[1];
    }
    
    return result;
  }

  // Create job for processing inbox item
  private async createInboxJob(itemId: string, type: string, extracted: Record<string, unknown>): Promise<void> {
    // Get default niche from config
    const defaultNiche = await this.env.NEXUS_KV.get('config:default_niche') || 'default';
    
    await this.env.NEXUS_CORE?.fetch("http://nexus-core/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Niche-ID": defaultNiche },
      body: JSON.stringify({
        job_type: 'inbox_process',
        entity_type: 'inbox_item',
        entity_id: itemId,
        input_json: {
          item_id: itemId,
          type: type,
          extracted: extracted,
        },
        priority: type === 'idea' ? 4 : 5,
      })
    });
  }

  // Send welcome message
  private async sendWelcome(chatId: number): Promise<void> {
    const message = `
🚀 Welcome to NEXUS Inbox Capture!

I help you capture ideas, notes, and tasks with zero friction.

Commands:
/note [text] - Capture a note
/task [text] - Create a task
/idea [text] - Submit a product idea
/help - Show this help

Just type and I'll extract the important stuff using AI.
    `.trim();
    
    await this.sendMessage(chatId, message);
  }

  // Send help message
  private async sendHelp(chatId: number): Promise<void> {
    const message = `
📋 NEXUS Inbox Capture Help

*Quick Capture:*
Just send any text — I'll save it as a note.

*Commands:*
/note Meeting with client about new feature
/task Fix login bug by Friday
/idea App that tracks water intake with reminders

*What happens next:*
1. AI extracts key info
2. Item goes to your NEXUS inbox
3. You can review and convert to products/tasks

*Tips:*
- Include priority words (urgent, asap, low priority)
- Mention dates for tasks
- Be descriptive for ideas
    `.trim();
    
    await this.sendMessage(chatId, message);
  }

  // Send message to chat
  async sendMessage(chatId: number | string, text: string): Promise<void> {
    if (!this.apiUrl) {
      console.log('[TELEGRAM] Would send:', text);
      return;
    }
    
    try {
      await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown',
        })
      });
    } catch (error) {
      console.error('[TELEGRAM] Failed to send message:', error);
    }
  }

  // Set webhook
  async setWebhook(webhookUrl: string): Promise<boolean> {
    if (!this.apiUrl) return false;
    
    try {
      const response = await fetch(`${this.apiUrl}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      });
      
      const result = await response.json();
      return result.ok === true;
    } catch (error) {
      console.error('[TELEGRAM] Failed to set webhook:', error);
      return false;
    }
  }
}
