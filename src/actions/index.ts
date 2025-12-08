import type { ActionAPIContext } from "astro:actions";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
  AiCharacters,
  CharacterChatMessages,
  CharacterChatSessions,
  and,
  db,
  eq,
  or,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

export const server = {
  createCharacter: defineAction({
    input: z.object({
      name: z.string().min(1),
      slug: z.string().min(1).optional(),
      shortDescription: z.string().optional(),
      fullDescription: z.string().optional(),
      systemPrompt: z.string().optional(),
      speakingStyle: z.string().optional(),
      domain: z.string().optional(),
      avatarUrl: z.string().url().optional(),
      isPublic: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const character = {
        id: crypto.randomUUID(),
        userId: user.id,
        name: input.name,
        slug: input.slug,
        shortDescription: input.shortDescription,
        fullDescription: input.fullDescription,
        systemPrompt: input.systemPrompt,
        speakingStyle: input.speakingStyle,
        domain: input.domain,
        avatarUrl: input.avatarUrl,
        isPublic: input.isPublic ?? false,
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      } satisfies typeof AiCharacters.$inferInsert;

      await db.insert(AiCharacters).values(character);

      return {
        success: true,
        data: { character },
      };
    },
  }),

  updateCharacter: defineAction({
    input: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      shortDescription: z.string().optional(),
      fullDescription: z.string().optional(),
      systemPrompt: z.string().optional(),
      speakingStyle: z.string().optional(),
      domain: z.string().optional(),
      avatarUrl: z.string().url().optional(),
      isPublic: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const existing = await db
        .select()
        .from(AiCharacters)
        .where(eq(AiCharacters.id, input.id));

      const character = existing[0];

      if (!character || character.userId !== user.id) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "Character not found or you do not have access.",
        });
      }

      const updateData: Partial<typeof AiCharacters.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.slug !== undefined) updateData.slug = input.slug;
      if (input.shortDescription !== undefined)
        updateData.shortDescription = input.shortDescription;
      if (input.fullDescription !== undefined)
        updateData.fullDescription = input.fullDescription;
      if (input.systemPrompt !== undefined)
        updateData.systemPrompt = input.systemPrompt;
      if (input.speakingStyle !== undefined)
        updateData.speakingStyle = input.speakingStyle;
      if (input.domain !== undefined) updateData.domain = input.domain;
      if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;
      if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;

      await db
        .update(AiCharacters)
        .set(updateData)
        .where(
          and(
            eq(AiCharacters.id, input.id),
            eq(AiCharacters.userId, user.id),
          ),
        );

      return {
        success: true,
        data: { id: input.id },
      };
    },
  }),

  listCharacters: defineAction({
    input: z.object({
      includePrivate: z.boolean().default(false),
    }),
    handler: async (input, context) => {
      const locals = context.locals as App.Locals | undefined;
      const userId = locals?.user?.id ?? null;

      const baseVisibility = or(
        eq(AiCharacters.isPublic, true),
        eq(AiCharacters.isSystem, true),
      );

      const whereClause =
        input.includePrivate && userId
          ? or(baseVisibility, eq(AiCharacters.userId, userId))
          : baseVisibility;

      const characters = await db
        .select()
        .from(AiCharacters)
        .where(whereClause);

      return {
        success: true,
        data: {
          items: characters,
          total: characters.length,
        },
      };
    },
  }),

  createChatSession: defineAction({
    input: z.object({
      characterId: z.string().min(1),
      title: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [character] = await db
        .select()
        .from(AiCharacters)
        .where(eq(AiCharacters.id, input.characterId));

      if (!character) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Character not found.",
        });
      }

      if (!character.isPublic && !character.isSystem && character.userId !== user.id) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "You do not have access to this character.",
        });
      }

      const now = new Date();
      const session = {
        id: crypto.randomUUID(),
        characterId: input.characterId,
        userId: user.id,
        title: input.title,
        contextSummary: null,
        isPinned: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: null,
      } satisfies typeof CharacterChatSessions.$inferInsert;

      await db.insert(CharacterChatSessions).values(session);

      return {
        success: true,
        data: { session },
      };
    },
  }),

  updateChatSession: defineAction({
    input: z.object({
      id: z.string().min(1),
      title: z.string().optional(),
      contextSummary: z.string().optional(),
      isPinned: z.boolean().optional(),
      isArchived: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [session] = await db
        .select()
        .from(CharacterChatSessions)
        .where(eq(CharacterChatSessions.id, input.id));

      if (!session || session.userId !== user.id) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "Session not found or you do not have access.",
        });
      }

      const updateData: Partial<typeof CharacterChatSessions.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.contextSummary !== undefined)
        updateData.contextSummary = input.contextSummary;
      if (input.isPinned !== undefined) updateData.isPinned = input.isPinned;
      if (input.isArchived !== undefined) updateData.isArchived = input.isArchived;

      await db
        .update(CharacterChatSessions)
        .set(updateData)
        .where(
          and(
            eq(CharacterChatSessions.id, input.id),
            eq(CharacterChatSessions.userId, user.id),
          ),
        );

      return {
        success: true,
        data: { id: input.id },
      };
    },
  }),

  listMyChatSessions: defineAction({
    input: z.object({
      includeArchived: z.boolean().default(false),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      let whereClause = eq(CharacterChatSessions.userId, user.id);
      if (!input.includeArchived) {
        whereClause = and(whereClause, eq(CharacterChatSessions.isArchived, false));
      }

      const sessions = await db
        .select()
        .from(CharacterChatSessions)
        .where(whereClause);

      return {
        success: true,
        data: {
          items: sessions,
          total: sessions.length,
        },
      };
    },
  }),

  createChatMessage: defineAction({
    input: z.object({
      sessionId: z.string().min(1),
      senderRole: z.enum(["user", "character", "system"]),
      content: z.string().min(1),
      metadata: z.record(z.any()).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [session] = await db
        .select()
        .from(CharacterChatSessions)
        .where(eq(CharacterChatSessions.id, input.sessionId));

      if (!session || session.userId !== user.id) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "Session not found or you do not have access.",
        });
      }

      const now = new Date();
      const message = {
        id: crypto.randomUUID(),
        sessionId: input.sessionId,
        userId: input.senderRole === "user" ? user.id : null,
        senderRole: input.senderRole,
        content: input.content,
        metadataJson: input.metadata
          ? JSON.stringify(input.metadata)
          : null,
        createdAt: now,
      } satisfies typeof CharacterChatMessages.$inferInsert;

      await db.insert(CharacterChatMessages).values(message);
      await db
        .update(CharacterChatSessions)
        .set({
          updatedAt: now,
          lastMessageAt: now,
        })
        .where(
          and(
            eq(CharacterChatSessions.id, input.sessionId),
            eq(CharacterChatSessions.userId, user.id),
          ),
        );

      return {
        success: true,
        data: { message },
      };
    },
  }),

  listChatMessages: defineAction({
    input: z.object({
      sessionId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [session] = await db
        .select()
        .from(CharacterChatSessions)
        .where(eq(CharacterChatSessions.id, input.sessionId));

      if (!session || session.userId !== user.id) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "Session not found or you do not have access.",
        });
      }

      const messages = await db
        .select()
        .from(CharacterChatMessages)
        .where(eq(CharacterChatMessages.sessionId, input.sessionId));

      return {
        success: true,
        data: {
          items: messages,
          total: messages.length,
        },
      };
    },
  }),
};
