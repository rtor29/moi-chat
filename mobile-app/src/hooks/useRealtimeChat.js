import { useState, useEffect, useRef, useCallback } from 'react';
import { Vibration } from 'react-native';
import supabase from '../config/supabase';
import ChatService from '../services/chatService';
import GroupService from '../services/groupService';

/**
 * خطاف React مخصص للدردشة الفورية المشفرة
 *
 * @param {string} groupId - معرف المجموعة
 * @param {CryptoKey} groupKey - مفتاح التشفير للمجموعة
 * @param {string} currentOfficerId - معرف الضابط الحالي
 */
export default function useRealtimeChat(groupId, groupKey, currentOfficerId) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isConnected, setIsConnected] = useState(true);

    const channelRef = useRef(null);
    const membersRef = useRef({});

    // تحميل أعضاء المجموعة (لمعرفة أسماء المرسلين)
    const loadMembers = useCallback(async () => {
        try {
            const members = await GroupService.getGroupMembers(groupId);
            const membersMap = {};
            members.forEach(m => {
                membersMap[m.id] = { full_name: m.full_name, rank: m.rank };
            });
            membersRef.current = membersMap;
        } catch (err) {
            console.error('خطأ تحميل الأعضاء:', err);
        }
    }, [groupId]);

    // تحميل الرسائل السابقة
    const loadMessages = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const msgs = await ChatService.getMessages(groupId, groupKey, 50, 0);
            setMessages(msgs);
        } catch (err) {
            setError(err.message);
            console.error('خطأ تحميل الرسائل:', err);
        } finally {
            setIsLoading(false);
        }
    }, [groupId, groupKey]);

    // إرسال رسالة
    const sendMessage = useCallback(async (text, messageType = 'text') => {
        if (!text || !text.trim()) return;

        const tempId = 'temp_' + Date.now();
        const content = text.trim();

        let activeOfficerId = currentOfficerId;
        if (!activeOfficerId) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: off } = await supabase
                        .from('officers')
                        .select('id')
                        .eq('auth_user_id', user.id)
                        .single();
                    activeOfficerId = off?.id;
                }
            } catch (e) {
                console.warn('تعذر جلب معرف الضابط:', e);
            }
        }

        // 1. إضافة الرسالة فوراً للواجهة ليراها المستخدم مباشرة
        const newLocalMsg = {
            _id: tempId,
            text: content,
            createdAt: new Date(),
            user: { _id: activeOfficerId || 'me', name: 'أنت' },
            messageType: messageType
        };

        setMessages(prev => [newLocalMsg, ...prev]);

        // 2. إرسالها إلى Supabase في الخلفية
        try {
            if (activeOfficerId) {
                const sentMsg = await ChatService.sendMessage(
                    groupId,
                    activeOfficerId,
                    content,
                    groupKey,
                    messageType
                );

                if (sentMsg?.id) {
                    setMessages(prev => prev.map(m => m._id === tempId ? { ...m, _id: sentMsg.id } : m));
                }
            }
        } catch (err) {
            console.warn('تم حفظ الرسالة محلياً لكن تعذر إرسالها:', err.message);
        }
    }, [groupId, currentOfficerId, groupKey]);

    // تحميل رسائل أقدم
    const loadMoreMessages = useCallback(async () => {
        if (isLoading) return;

        try {
            const olderMsgs = await ChatService.getMessages(
                groupId, groupKey, 30, messages.length
            );

            if (olderMsgs.length > 0) {
                setMessages(prev => [...prev, ...olderMsgs]);
            }

            return olderMsgs.length > 0;
        } catch (err) {
            console.error('خطأ تحميل المزيد:', err);
            return false;
        }
    }, [groupId, groupKey, messages.length, isLoading]);

    // تعديل رسالة
    const editMessage = useCallback(async (messageId, newText) => {
        try {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, text: newText } : m));
            await ChatService.editMessage(messageId, newText);
        } catch (err) {
            console.error('خطأ تعديل الرسالة:', err);
        }
    }, []);

    // حذف رسالة
    const deleteMessage = useCallback(async (messageId) => {
        try {
            setMessages(prev => prev.filter(m => m._id !== messageId));
            await ChatService.deleteMessage(messageId);
        } catch (err) {
            console.error('خطأ حذف الرسالة:', err);
        }
    }, []);

    // إعداد الاشتراك في Realtime + التزامن التلقائي
    useEffect(() => {
        if (!groupId) return;

        loadMembers();
        loadMessages();

        // 1. تحديث دوري كخطة بديلة لضمان الوصول الفوري بين كافة الهواتف (كل 2.5 ثانية)
        const pollInterval = setInterval(() => {
            loadMessages();
        }, 2500);

        // 2. اشتراك Realtime الفوري للإضافة والتعديل والحذف
        const channel = supabase
            .channel(`realtime_msgs_${groupId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                async (payload) => {
                    const newMsg = payload.new;
                    if (newMsg.group_id === groupId || newMsg.chat_id === groupId) {
                        const senderInfo = membersRef.current[newMsg.sender_id] || {};
                        const formatted = {
                            _id: newMsg.id,
                            text: newMsg.content || newMsg.encrypted_content || '',
                            createdAt: new Date(newMsg.created_at || Date.now()),
                            user: {
                                _id: newMsg.sender_id,
                                name: senderInfo.full_name || 'ضابط',
                            },
                            messageType: newMsg.message_type || newMsg.type || 'text',
                            senderRank: senderInfo.rank || '',
                        };

                        setMessages(prev => {
                            if (prev.some(m => m._id === newMsg.id)) return prev;
                            if (newMsg.sender_id !== currentOfficerId) {
                                Vibration.vibrate([0, 200, 100, 200]);
                            }
                            return [formatted, ...prev];
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    const updated = payload.new;
                    setMessages(prev => prev.map(m => m._id === updated.id ? { ...m, text: updated.content || updated.encrypted_content || m.text } : m));
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'messages',
                },
                (payload) => {
                    const deletedId = payload.old.id;
                    setMessages(prev => prev.filter(m => m._id !== deletedId));
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            clearInterval(pollInterval);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [groupId, currentOfficerId, loadMembers, loadMessages]);

    return {
        messages,
        isLoading,
        error,
        isConnected,
        sendMessage,
        editMessage,
        deleteMessage,
        loadMoreMessages,
    };
}
