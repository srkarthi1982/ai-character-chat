/**
 * AI Character Chat - chat with custom characters / personas.
 *
 * Design goals:
 * - Characters (system or user-created) with persona + style.
 * - Chat sessions per character.
 * - Messages grouped under a session (multi-turn history).
 */

import { defineTable, column, NOW } from "astro:db";

export const AiCharacters = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    // If null => global/system character (e.g. "Wise Mentor")
    userId: column.text({ optional: true }),

    name: column.text(),                              // "Stoic Mentor", "Sci-Fi Captain"
    slug: column.text({ optional: true }),            // optional for URL/id
    shortDescription: column.text({ optional: true }),// one-liner summary
    fullDescription: column.text({ optional: true }), // longer description for UI

    systemPrompt: column.text({ optional: true }),    // instructions to define persona (for model)
    speakingStyle: column.text({ optional: true }),   // "formal", "playful", "sarcastic"
    domain: column.text({ optional: true }),          // "productivity", "storytelling", etc.

    avatarUrl: column.text({ optional: true }),
    isSystem: column.boolean({ default: false }),
    isPublic: column.boolean({ default: false }),     // visible to others or private

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const CharacterChatSessions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    characterId: column.text({
      references: () => AiCharacters.columns.id,
    }),
    userId: column.text(),

    title: column.text({ optional: true }),           // "Career advice with Stoic Mentor"
    contextSummary: column.text({ optional: true }),  // optional last-summarized context

    isPinned: column.boolean({ default: false }),
    isArchived: column.boolean({ default: false }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
    lastMessageAt: column.date({ optional: true }),
  },
});

export const CharacterChatMessages = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    sessionId: column.text({
      references: () => CharacterChatSessions.columns.id,
    }),
    userId: column.text({ optional: true }),          // null for character messages

    // "user" = human, "character" = AI persona, "system" if needed later
    senderRole: column.text(),                        // "user", "character", "system"
    content: column.text(),                           // message text

    // optional JSON for future (e.g. tool calls, metadata)
    metadataJson: column.text({ optional: true }),

    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  AiCharacters,
  CharacterChatSessions,
  CharacterChatMessages,
} as const;
