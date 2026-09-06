// ============================================================
// MOI Chat — Chat Service (E2EE)
// نظام الدردشة الآمنة — خدمة الدردشة المشفرة
// ============================================================

import supabase from '../config/supabase';
import { encryptMessage, decryptMessage } from '../crypto/e2ee';

const ChatService = {
    /**
     * إرسال رسالة مشفرة
     *
     * @param {string} groupId - معرف المجموعة
     * @param {string} senderId - معرف الضابط المرسل
     * @param {string} plaintext - نص الرسالة (سيُشفَّر)
     * @param {CryptoKey} groupKey - مفتاح المجموعة (DEK)
     * @param {string} messageType - نوع الرسالة ('text', 'image', 'file')
     */
    /**
     * رفع صورة المحادثة إلى Supabase Storage للحصول على رابط سريع وعالي الجودة
     */
    async uploadChatImage(base64OrUri) {
        if (!base64OrUri) return base64OrUri;
        if (base64OrUri.startsWith('http://') || base64OrUri.startsWith('https://')) {
            return base64OrUri;
        }

        try {
            const cleanBase64 = base64OrUri.replace(/^data:image\/\w+;base64,/, '');
            const binaryString = atob(cleanBase64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const fileName = `chat_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
            const filePath = `chat/${fileName}`;

            const { data, error } = await supabase.storage
                .from('officer-avatars')
                .upload(filePath, bytes.buffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (!error && data) {
                const { data: publicUrlData } = supabase.storage
                    .from('officer-avatars')
                    .getPublicUrl(filePath);

                if (publicUrlData?.publicUrl) {
                    return publicUrlData.publicUrl;
                }
            }
        } catch (e) {
            console.warn('تعذر الرفع إلى Storage، استخدام السلسلة المباشرة:', e.message);
        }

        return base64OrUri.startsWith('data:') ? base64OrUri : `data:image/jpeg;base64,${base64OrUri}`;
    },

    /**
     * إرسال رسالة مشفرة
     */
    async sendMessage(groupId, senderId, plaintext, groupKey, messageType = 'text') {
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(groupId);

        const typeInt = messageType === 'image' ? 1 : (messageType === 'file' ? 2 : 0);

        let finalContent = plaintext;
        if (messageType === 'image') {
            finalContent = await this.uploadChatImage(plaintext);
        }

        const payload = {
            sender_id: senderId,
            encrypted_content: finalContent,
            content: finalContent,
            iv: '',
            message_type: messageType,
            type: typeInt,
        };

        payload.chat_id = groupId;
        if (isUuid) {
            payload.group_id = groupId;
        }

        const { data, error } = await supabase
            .from('messages')
            .insert(payload)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    },

    /**
     * تعديل رسالة
     */
    async editMessage(messageId, newContent) {
        const { data, error } = await supabase
            .from('messages')
            .update({
                content: newContent,
                encrypted_content: newContent
            })
            .eq('id', messageId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    },

    /**
     * حذف رسالة
     */
    async deleteMessage(messageId) {
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', messageId);

        if (error) throw new Error(error.message);
        return true;
    },

    /**
     * جلب رسائل مجموعة (دردشة مباشرة)
     */
    async getMessages(groupId, groupKey, limit = 50, offset = 0) {
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(groupId);

        let query = supabase
            .from('messages')
            .select(`
                id,
                group_id,
                chat_id,
                sender_id,
                content,
                encrypted_content,
                iv,
                message_type,
                type,
                created_at
            `);

        if (isUuid) {
            query = query.or(`group_id.eq.${groupId},chat_id.eq.${groupId}`);
        } else {
            query = query.eq('chat_id', groupId);
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw new Error(error.message);

        // جلب أسماء الضباط من جدول officers للمرسلين
        const senderIds = [...new Set((data || []).map(m => m.sender_id).filter(Boolean))];
        let officersMap = {};
        if (senderIds.length > 0) {
            try {
                const { data: officers } = await supabase
                    .from('officers')
                    .select('id, full_name, rank, statistical_number')
                    .in('id', senderIds);
                (officers || []).forEach(off => {
                    officersMap[off.id] = off;
                });
            } catch (e) {
                console.warn('تعذر جلب بيانات الضباط:', e);
            }
        }

        return (data || []).map(msg => {
            const officer = officersMap[msg.sender_id] || {};
            return {
                _id: msg.id,
                text: msg.content || msg.encrypted_content || '',
                createdAt: new Date(msg.created_at),
                user: {
                    _id: msg.sender_id,
                    name: officer.full_name || 'ضابط',
                    avatar: null,
                },
                messageType: msg.message_type || msg.type || 'text',
                senderRank: officer.rank || '',
            };
        });
    },

    /**
     * فك تشفير رسالة واحدة واردة من Realtime
     *
     * @param {Object} rawMessage - الرسالة الخام من Supabase Realtime
     * @param {CryptoKey} groupKey - مفتاح المجموعة
     * @param {Object} senderInfo - معلومات المرسل {full_name, rank}
     */
    async decryptIncomingMessage(rawMessage, groupKey, senderInfo = {}) {
        try {
            const text = await decryptMessage(
                rawMessage.encrypted_content,
                rawMessage.iv,
                groupKey
            );

            return {
                _id: rawMessage.id,
                text: text,
                createdAt: new Date(rawMessage.created_at),
                user: {
                    _id: rawMessage.sender_id,
                    name: senderInfo.full_name || 'غير معروف',
                },
                messageType: rawMessage.message_type,
                senderRank: senderInfo.rank || '',
            };
        } catch {
            return {
                _id: rawMessage.id,
                text: '🔒 رسالة مشفرة',
                createdAt: new Date(rawMessage.created_at),
                user: {
                    _id: rawMessage.sender_id,
                    name: senderInfo.full_name || 'غير معروف',
                },
                isEncryptionError: true,
            };
        }
    },
};

export default ChatService;
