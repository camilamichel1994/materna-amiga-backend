import { and, eq, desc, or, isNull, ne, count } from 'drizzle-orm'
import { db } from '../db'
import { chats, messages, users, listings } from '../db/schema'

export async function getChats(userId: string) {
  try {
    const userChats = await db
      .select({
        id: chats.id,
        listingId: chats.listingId,
        user1Id: chats.user1Id,
        user2Id: chats.user2Id,
        updatedAt: chats.updatedAt,
        listing: {
          id: listings.id,
          name: listings.name,
          photos: listings.photos,
        },
      })
      .from(chats)
      .leftJoin(listings, eq(chats.listingId, listings.id))
      .where(or(eq(chats.user1Id, userId), eq(chats.user2Id, userId)))

    const chatsWithDetails = await Promise.all(
      userChats.map(async chat => {
        const otherUserId = chat.user1Id === userId ? chat.user2Id : chat.user1Id

        const otherUser = await db
          .select({
            id: users.id,
            name: users.name,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(eq(users.id, otherUserId))
          .limit(1)

        const lastMessage = await db
          .select({
            text: messages.text,
            createdAt: messages.createdAt,
          })
          .from(messages)
          .where(eq(messages.chatId, chat.id))
          .orderBy(desc(messages.createdAt))
          .limit(1)

        const unreadCount = await db
          .select({ count: count() })
          .from(messages)
          .where(
            and(
              eq(messages.chatId, chat.id),
              ne(messages.senderId, userId),
              isNull(messages.readAt)
            )
          )

        return {
          id: chat.id,
          other_user: {
            id: otherUser[0]?.id,
            name: otherUser[0]?.name,
            avatar_url: otherUser[0]?.avatarUrl,
          },
          item: chat.listing
            ? {
                id: chat.listing.id,
                name: chat.listing.name,
                images: chat.listing.photos,
              }
            : null,
          last_message: lastMessage[0]
            ? {
                text: lastMessage[0].text,
                created_at: lastMessage[0].createdAt.toISOString(),
              }
            : null,
          unread_count: unreadCount[0]?.count || 0,
        }
      })
    )

    return {
      success: true,
      status: 200,
      data: { chats: chatsWithDetails },
    }
  } catch (error) {
    console.error('Error getting chats:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function getChatMessages(chatId: string, userId: string, page: number = 1, limit: number = 50) {
  try {
    const chat = await db
      .select({ id: chats.id, user1Id: chats.user1Id, user2Id: chats.user2Id })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1)

    if (chat.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Chat not found',
      }
    }

    if (chat[0]!.user1Id !== userId && chat[0]!.user2Id !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You do not have access to this chat',
      }
    }

    const offset = (page - 1) * limit

    const messagesList = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        text: messages.text,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset)

    const totalResult = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.chatId, chatId))

    const total = totalResult[0]?.count || 0

    return {
      success: true,
      status: 200,
      data: {
        messages: messagesList.reverse().map(msg => ({
          id: msg.id,
          sender_id: msg.senderId,
          text: msg.text,
          created_at: msg.createdAt.toISOString(),
        })),
        total,
        page,
        limit,
      },
    }
  } catch (error) {
    console.error('Error getting chat messages:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function sendMessage(chatId: string, userId: string, text: string) {
  try {
    const chat = await db
      .select({ id: chats.id, user1Id: chats.user1Id, user2Id: chats.user2Id })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1)

    if (chat.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Chat not found',
      }
    }

    if (chat[0]!.user1Id !== userId && chat[0]!.user2Id !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You do not have access to this chat',
      }
    }

    const result = await db
      .insert(messages)
      .values({
        chatId,
        senderId: userId,
        text,
      })
      .returning({
        id: messages.id,
        senderId: messages.senderId,
        text: messages.text,
        createdAt: messages.createdAt,
      })

    await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId))

    return {
      success: true,
      status: 201,
      data: {
        id: result[0]!.id,
        sender_id: result[0]!.senderId,
        text: result[0]!.text,
        created_at: result[0]!.createdAt.toISOString(),
      },
    }
  } catch (error) {
    console.error('Error sending message:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function createChat(userId: string, itemId: string, receiverId: string, message: string) {
  try {
    const existing = await db
      .select({ id: chats.id })
      .from(chats)
      .where(
        and(
          eq(chats.listingId, itemId),
          or(
            and(eq(chats.user1Id, userId), eq(chats.user2Id, receiverId)),
            and(eq(chats.user1Id, receiverId), eq(chats.user2Id, userId))
          )
        )
      )
      .limit(1)

    let chatId: string

    if (existing.length > 0) {
      chatId = existing[0]!.id
    } else {
      const chatResult = await db
        .insert(chats)
        .values({
          listingId: itemId,
          user1Id: userId,
          user2Id: receiverId,
        })
        .returning({ id: chats.id })

      chatId = chatResult[0]!.id
    }

    const messageResult = await db
      .insert(messages)
      .values({
        chatId,
        senderId: userId,
        text: message,
      })
      .returning({
        id: messages.id,
        senderId: messages.senderId,
        text: messages.text,
        createdAt: messages.createdAt,
      })

    return {
      success: true,
      status: 201,
      data: {
        chat_id: chatId,
        message: {
          id: messageResult[0]!.id,
          sender_id: messageResult[0]!.senderId,
          text: messageResult[0]!.text,
          created_at: messageResult[0]!.createdAt.toISOString(),
        },
      },
    }
  } catch (error) {
    console.error('Error creating chat:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

export async function markChatAsRead(chatId: string, userId: string) {
  try {
    const chat = await db
      .select({ id: chats.id, user1Id: chats.user1Id, user2Id: chats.user2Id })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1)

    if (chat.length === 0) {
      return {
        success: false,
        status: 404,
        error: 'NotFound',
        message: 'Chat not found',
      }
    }

    if (chat[0]!.user1Id !== userId && chat[0]!.user2Id !== userId) {
      return {
        success: false,
        status: 403,
        error: 'Forbidden',
        message: 'You do not have access to this chat',
      }
    }

    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messages.chatId, chatId),
          ne(messages.senderId, userId),
          isNull(messages.readAt)
        )
      )

    return {
      success: true,
      status: 200,
      message: 'Messages marked as read',
    }
  } catch (error) {
    console.error('Error marking chat as read:', error)
    return {
      success: false,
      status: 500,
      error: 'ServerError',
      message: 'Unexpected error occurred',
    }
  }
}

