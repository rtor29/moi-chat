// ============================================================
// MOI Chat — Chat Screen (E2EE)
// نظام الدردشة الآمنة — شاشة الدردشة المشفرة
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    FlatList, StyleSheet, KeyboardAvoidingView,
    Platform, ActivityIndicator, StatusBar, Image, Linking
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MessageBubble from '../components/MessageBubble';
import useRealtimeChat from '../hooks/useRealtimeChat';
import GroupService from '../services/groupService';
import { initializeKEK, unwrapGroupKey, deriveFallbackGroupKey } from '../crypto/e2ee';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';

const COLORS = {
    bg: '#0a0e17',
    headerBg: '#111827',
    inputBg: '#1a2332',
    primary: '#c8a84e',
    accent: '#2ecc71',
    textPrimary: '#f0f2f5',
    textSecondary: '#8899aa',
    textMuted: '#5a6a7a',
    border: 'rgba(200,168,78,0.15)',
    sendBtn: '#c8a84e',
};

export default function ChatScreen({ route, navigation, lang, toggleLang, t }) {
    const { groupId = 'default', groupName = 'محادثة', officerId = '' } = route?.params || {};

    const text = t || {
        connectedEncrypted: 'متصل — مشفّر',
        connecting: 'قيد الاتصال...',
        writeEncryptedMsg: 'اكتب رسالة مشفّرة...',
        encryptedNotice: '🔐 الرسائل مشفّرة من طرف لطرف بتقنية AES-256',
        noMessages: 'لا توجد رسائل بعد\nابدأ المحادثة',
        keyLoading: 'جاري تحميل مفاتيح التشفير...',
        keyErrorTitle: 'لم يتم العثور على مفتاح التشفير لهذه المجموعة',
        keyErrorSub: 'تواصل مع المشرف لتفعيل مفتاح التشفير',
        back: 'العودة',
    };

    const [groupKey, setGroupKey] = useState(null);
    const [inputText, setInputText] = useState('');
    const [isKeyLoading, setIsKeyLoading] = useState(true);
    const [keyError, setKeyError] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [groupMembers, setGroupMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null);
    const [showImageModal, setShowImageModal] = useState(false);
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [selectedMsgForOptions, setSelectedMsgForOptions] = useState(null);
    const [editMsgInput, setEditMsgInput] = useState('');
    const [isEditMode, setIsEditMode] = useState(false);

    // حالة الاتصال اللاسلكي الفوري من داخل التطبيق
    const [activeCallMember, setActiveCallMember] = useState(null);
    const [showCallChoiceMember, setShowCallChoiceMember] = useState(null);
    const [callMuted, setCallMuted] = useState(false);
    const [callSpeaker, setCallSpeaker] = useState(true);
    // حالة البصمة الصوتية
    const [recording, setRecording] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingTimerRef = useRef(null);

    const startAudioRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                alert('تنبيه: يرجى الموافقة على إذن الميكروفون لتسجيل بصمة صوتية');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(newRecording);
            setIsRecording(true);
            setRecordingDuration(0);

            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.warn('فشل بدء التسجيل:', err);
            alert('تعذر فتح الميكروفون: ' + err.message);
        }
    };

    const stopAndSendAudioRecording = async () => {
        if (!recording) return;

        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        setIsRecording(false);

        try {
            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            const uri = recording.getURI();
            setRecording(null);

            if (uri) {
                setIsSending(true);
                const base64Audio = await fetch(uri)
                    .then(res => res.blob())
                    .then(blob => new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    }));

                await sendMessage(base64Audio, 'audio');
                setIsSending(false);
            }
        } catch (err) {
            console.warn('فشل إرسال البصمة الصوتية:', err);
            alert('تعذر إرسال البصمة الصوتية: ' + err.message);
            setIsSending(false);
            setRecording(null);
        }
    };

    const cancelAudioRecording = async () => {
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        setIsRecording(false);
        if (recording) {
            try {
                await recording.stopAndUnloadAsync();
            } catch (e) {}
            setRecording(null);
        }
    };

    const flatListRef = useRef(null);

    const handleCellularCall = (phone, statisticalNumber) => {
        const numToCall = (phone && phone.trim()) ? phone.trim() : null;
        if (numToCall) {
            const cleanNum = numToCall.replace(/[^0-9+]/g, '');
            Linking.openURL(`tel:${cleanNum || numToCall}`).catch(err => {
                alert('فشل فتح تطبيق الاتصال: ' + err.message);
            });
        } else {
            alert(`لا يوجد رقم هاتف شريحة مسجل لهذا الضابط (${statisticalNumber || ''})`);
        }
    };

    // عداد الوقت للمكالمة اللاسلكية
    useEffect(() => {
        let interval = null;
        if (activeCallMember) {
            interval = setInterval(() => {
                setCallTimer(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [activeCallMember]);

    const formatCallDuration = (seconds) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const startInAppCall = (member) => {
        setShowMembersModal(false);
        setActiveCallMember(member);
        setCallMuted(false);
        setCallSpeaker(true);
        setCallTimer(0);
    };

    // تحميل مفتاح التشفير للمجموعة
    useEffect(() => {
        const loadGroupKey = async () => {
            try {
                // جلب المفتاح المغلَّف من Supabase
                const keyData = await GroupService.getMyGroupKey(groupId);

                if (keyData) {
                    const kek = await initializeKEK('');
                    const unwrappedKey = await unwrapGroupKey(
                        keyData.encrypted_key,
                        keyData.iv || '',
                        kek
                    );
                    setGroupKey(unwrappedKey);
                } else {
                    // المفتاح الاحتياطي الافتراضي للمجموعة
                    const fallbackKey = await deriveFallbackGroupKey(groupId);
                    setGroupKey(fallbackKey);
                }
            } catch (err) {
                console.warn('استخدام مفتاح التشفير الاحتياطي للمجموعة:', err.message);
                const fallbackKey = await deriveFallbackGroupKey(groupId);
                setGroupKey(fallbackKey);
            } finally {
                setIsKeyLoading(false);
            }
        };

        loadGroupKey();
    }, [groupId]);

    // خطاف الدردشة الفورية
    const {
        messages = [],
        isLoading = false,
        error: chatError = null,
        isConnected = true,
        sendMessage = () => {},
        editMessage = () => {},
        deleteMessage = () => {},
        loadMoreMessages = () => {},
    } = useRealtimeChat(groupId, groupKey, officerId) || {};

    // إرسال رسالة
    const handleSend = useCallback(async () => {
        if (!inputText.trim() || isSending) return;

        setIsSending(true);
        try {
            await sendMessage(inputText.trim());
            setInputText('');
        } catch (err) {
            console.error('خطأ إرسال:', err);
        } finally {
            setIsSending(false);
        }
    }, [inputText, isSending, sendMessage]);

    // تحميل رسائل أقدم
    const handleLoadMore = useCallback(() => {
        if (!isLoading) {
            loadMoreMessages();
        }
    }, [isLoading, loadMoreMessages]);


    // جلب أعضاء المجموعة عند فتح النافذة
    const openMembers = async () => {
        try {
            const members = await GroupService.getGroupMembers(groupId);
            setGroupMembers(members);
            setShowMembersModal(true);
        } catch (err) {
            console.error('خطأ جلب الأعضاء:', err);
        }
    };

    // فتح محادثة ثنائية خاصة مع ضابط معين
    const startPrivateChat = (member) => {
        setShowMembersModal(false);
        const myId = officerId || 'me';
        const sortedIds = [myId, member.id].sort();
        const privateRoomId = `private_${sortedIds[0]}_${sortedIds[1]}`;

        navigation.push('Chat', {
            groupId: privateRoomId,
            groupName: `💬 خاص: ${member.full_name}`,
            officerId: myId
        });
    };

    // ==================== الرأس ====================
    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.goBack()}
            >
                <Text style={styles.backText}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerCenter} onPress={openMembers} activeOpacity={0.7}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {groupName}
                </Text>
                <View style={styles.headerMeta}>
                    <View style={[
                        styles.statusDot,
                        { backgroundColor: COLORS.accent }
                    ]} />
                    <Text style={styles.headerSubtitle}>
                        متصل — مشفّر • 👥 الأعضاء
                    </Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.lockIcon} onPress={openMembers}>
                <Text style={styles.lockText}>👥</Text>
            </TouchableOpacity>
        </View>
    );

    // فتح استوديو الصور بالهاتف
    const pickFromGallery = async () => {
        try {
            setShowImageModal(false);
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                alert('يرجى السماح بالوصول للصور في إعدادات الهاتف');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.35,
                base64: true,
                allowsEditing: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
                await sendMessage(uri, 'image');
            }
        } catch (err) {
            console.error('خطأ اختيار صورة:', err);
            alert('حدث خطأ في فتح المعرض: ' + err.message);
        }
    };

    // فتح كاميرا الهاتف
    const takePhotoFromCamera = async () => {
        try {
            setShowImageModal(false);
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                alert('يرجى السماح بالوصول للكاميرا في إعدادات الهاتف');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.35,
                base64: true,
                allowsEditing: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
                await sendMessage(uri, 'image');
            }
        } catch (err) {
            console.error('خطأ الكاميرا:', err);
            alert('حدث خطأ في فتح الكاميرا: ' + err.message);
        }
    };

    const handleSendPhotoSubmit = () => {
        if (imageUrlInput.trim()) {
            sendMessage(imageUrlInput.trim(), 'image');
            setImageUrlInput('');
            setShowImageModal(false);
        }
    };

    // ==================== شريط الإدخال ====================
    const renderInputBar = () => {
        if (isRecording) {
            return (
                <View style={[styles.inputBar, { backgroundColor: 'rgba(231,76,60,0.15)', borderColor: 'rgba(231,76,60,0.3)', borderTopWidth: 1, paddingVertical: 10, flexDirection: 'row-reverse' }]}>
                    <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 6 }} onPress={cancelAudioRecording}>
                        <Text style={{ fontSize: 14, color: '#e74c3c', fontWeight: '700' }}>إلغاء ✕</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1, alignItems: 'center' }}>
                        <Text style={{ color: '#e74c3c', fontWeight: '700', fontSize: 13 }}>
                            🔴 جاري تسجيل بصمة: {formatCallDuration(recordingDuration)}
                        </Text>
                    </View>

                    <TouchableOpacity style={{ backgroundColor: '#2ecc71', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }} onPress={stopAndSendAudioRecording}>
                        <Text style={{ color: '#0a0e17', fontWeight: '700', fontSize: 13 }}>إرسال ⚡</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.inputBar}>
                <TouchableOpacity
                    style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!inputText.trim() || isSending}
                >
                    {isSending ? (
                        <ActivityIndicator size="small" color={COLORS.bg} />
                    ) : (
                        <Text style={styles.sendBtnText}>➤</Text>
                    )}
                </TouchableOpacity>

                <TextInput
                    style={[styles.textInput, { textAlign: lang === 'ar' ? 'right' : 'left', writingDirection: lang === 'ar' ? 'rtl' : 'ltr' }]}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="اكتب رسالة..."
                    placeholderTextColor={COLORS.textMuted}
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                    editable={true}
                />

                <TouchableOpacity
                    style={{ padding: 8, justifyContent: 'center', alignItems: 'center' }}
                    onPress={startAudioRecording}
                >
                    <Text style={{ fontSize: 20 }}>🎤</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={{ padding: 8, justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => setShowImageModal(true)}
                >
                    <Text style={{ fontSize: 20 }}>📷</Text>
                </TouchableOpacity>
            </View>
        );
    };

    // ==================== حالة التحميل ====================
    if (isKeyLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>جاري التحميل...</Text>
            </View>
        );
    }

    const handleLongPressMsg = (msg) => {
        const isMyMsg = msg.user?._id === officerId || msg.sender_id === officerId;
        const isAdmin = officerId === 'admin' || route?.params?.userRole === 'admin';

        if (!isMyMsg && !isAdmin) {
            alert('عذراً، يتاح التعديل والحذف لصاحب الرسالة أو مشرف المجموعة فقط.');
            return;
        }

        setSelectedMsgForOptions(msg);
        setEditMsgInput(msg.text || '');
        setIsEditMode(false);
    };

    const handleConfirmEditMsg = () => {
        if (selectedMsgForOptions && editMsgInput.trim()) {
            editMessage(selectedMsgForOptions._id, editMsgInput.trim());
            setSelectedMsgForOptions(null);
        }
    };

    const handleConfirmDeleteMsg = () => {
        if (selectedMsgForOptions) {
            deleteMessage(selectedMsgForOptions._id);
            setSelectedMsgForOptions(null);
        }
    };

    // ==================== الشاشة الرئيسية ====================
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

            {renderHeader()}


            <KeyboardAvoidingView
                style={styles.chatArea}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                {/* قائمة الرسائل */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item._id}
                    renderItem={({ item }) => (
                        <TouchableOpacity activeOpacity={0.8} onLongPress={() => handleLongPressMsg(item)}>
                            <MessageBubble
                                message={item}
                                isMe={item.user?._id === officerId}
                            />
                        </TouchableOpacity>
                    )}
                    inverted
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.3}
                    contentContainerStyle={styles.messagesList}
                    showsVerticalScrollIndicator={false}
                />

                {!isLoading && messages.length === 0 && (
                    <View style={styles.emptyChatOverlay} pointerEvents="none">
                        <Text style={styles.emptyChatIcon}>💬</Text>
                        <Text style={styles.emptyChatText}>
                            لا توجد رسائل بعد{'\n'}ابدأ المحادثة
                        </Text>
                    </View>
                )}

                {/* شريط الإدخال */}
                {renderInputBar()}
            </KeyboardAvoidingView>

            {/* modal أعضاء المجموعة */}
            {showMembersModal && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>👥 أعضاء المجموعة ({groupMembers.length})</Text>
                            <TouchableOpacity onPress={() => setShowMembersModal(false)}>
                                <Text style={styles.closeBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={groupMembers}
                            keyExtractor={(item) => item.id}
                            style={{ maxHeight: 350 }}
                            renderItem={({ item }) => (
                                <View style={styles.memberRow}>
                                    <View style={styles.memberAvatar}>
                                        {item.avatar_url ? (
                                            <Image source={{ uri: item.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                                        ) : (
                                            <Text style={styles.memberAvatarText}>{item.full_name?.[0] || '👮'}</Text>
                                        )}
                                    </View>
                                    <View style={styles.memberInfo}>
                                        <Text style={styles.memberName}>{item.full_name}</Text>
                                        <Text style={styles.memberMeta}>{item.rank} • الرقم الإحصائي: {item.statistical_number}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        <TouchableOpacity
                                            style={[styles.callMemberBtn, { backgroundColor: 'rgba(200,168,78,0.15)', borderColor: COLORS.primary }]}
                                            onPress={() => startPrivateChat(item)}
                                        >
                                            <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '600' }}>💬 خاص</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.callMemberBtn}
                                            onPress={() => {
                                                setShowMembersModal(false);
                                                setShowCallChoiceMember(item);
                                            }}
                                        >
                                            <Text style={{ fontSize: 16 }}>📞</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        />
                    </View>
                </View>
            )}

            {/* modal اختيار نوع الاتصال بالضابط */}
            {showCallChoiceMember && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>📞 اختيار طريقة الاتصال بالضابط</Text>
                            <TouchableOpacity onPress={() => setShowCallChoiceMember(null)}>
                                <Text style={styles.closeBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={{ color: COLORS.textSecondary, marginBottom: 16, textAlign: 'center', fontWeight: '600' }}>
                            {showCallChoiceMember.rank ? `${showCallChoiceMember.rank} ` : ''}{showCallChoiceMember.full_name}
                        </Text>

                        <TouchableOpacity
                            style={{ backgroundColor: 'rgba(200,168,78,0.15)', borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 10 }}
                            onPress={() => {
                                const m = showCallChoiceMember;
                                setShowCallChoiceMember(null);
                                startInAppCall(m);
                            }}
                        >
                            <Text style={{ fontSize: 22 }}>📶</Text>
                            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 }}>اتصال لاسلكي عبر البرنامج</Text>
                                <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>مكالمة صوتية فورية داخل التطبيق</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ backgroundColor: 'rgba(46,204,113,0.15)', borderWidth: 1, borderColor: COLORS.accent, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 14 }}
                            onPress={() => {
                                const m = showCallChoiceMember;
                                setShowCallChoiceMember(null);
                                handleCellularCall(m.phone, m.statistical_number);
                            }}
                        >
                            <Text style={{ fontSize: 22 }}>📱</Text>
                            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 }}>اتصال عبر شبكة الهاتف</Text>
                                <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>الاتصال الهاتفي المباشر عبر الشريحة</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, borderRadius: 8, alignItems: 'center' }}
                            onPress={() => setShowCallChoiceMember(null)}
                        >
                            <Text style={{ color: '#fff' }}>إلغاء</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* modal إرسال الصور */}
            {showImageModal && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>📷 إرسال صورة في المحادثة</Text>
                            <TouchableOpacity onPress={() => setShowImageModal(false)}>
                                <Text style={styles.closeBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <View style={{ gap: 10, marginVertical: 8 }}>
                            <TouchableOpacity
                                style={{ backgroundColor: 'rgba(200,168,78,0.15)', borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}
                                onPress={pickFromGallery}
                            >
                                <Text style={{ fontSize: 20 }}>🖼️</Text>
                                <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 }}>فتح استوديو الهاتف (المعرض)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{ backgroundColor: 'rgba(46,204,113,0.15)', borderWidth: 1, borderColor: COLORS.accent, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}
                                onPress={takePhotoFromCamera}
                            >
                                <Text style={{ fontSize: 20 }}>📸</Text>
                                <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 }}>التقاط صورة بالكاميرا</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginVertical: 8 }}>أو أدخل رابط صورة مباشرة</Text>

                        <TextInput
                            style={[styles.textInput, { marginBottom: 12, textAlign: 'right', backgroundColor: '#0f1923' }]}
                            value={imageUrlInput}
                            onChangeText={setImageUrlInput}
                            placeholder="https://..."
                            placeholderTextColor={COLORS.textMuted}
                        />

                        <View style={{ flexDirection: 'row-reverse', gap: 10, justifyContent: 'space-between' }}>
                            <TouchableOpacity
                                style={{ backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flex: 1, alignItems: 'center' }}
                                onPress={handleSendPhotoSubmit}
                            >
                                <Text style={{ color: '#0a0e17', fontWeight: '700' }}>إرسال الرابط</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 }}
                                onPress={() => setShowImageModal(false)}
                            >
                                <Text style={{ color: '#fff' }}>إلغاء</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* modal خيارات الرسالة (تعديل ومسح) */}
            {selectedMsgForOptions && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>⚙️ خيارات الرسالة</Text>
                            <TouchableOpacity onPress={() => setSelectedMsgForOptions(null)}>
                                <Text style={styles.closeBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {isEditMode ? (
                            <View style={{ gap: 12, marginVertical: 8 }}>
                                <Text style={{ color: COLORS.textMuted, fontSize: 13, textAlign: 'right' }}>تعديل نص الرسالة:</Text>
                                <TextInput
                                    style={[styles.textInput, { textAlign: 'right', backgroundColor: '#0f1923' }]}
                                    value={editMsgInput}
                                    onChangeText={setEditMsgInput}
                                    multiline
                                />
                                <View style={{ flexDirection: 'row-reverse', gap: 10, justifyContent: 'space-between' }}>
                                    <TouchableOpacity
                                        style={{ backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, flex: 1, alignItems: 'center' }}
                                        onPress={handleConfirmEditMsg}
                                    >
                                        <Text style={{ color: '#0a0e17', fontWeight: '700' }}>حفظ التعديل</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 }}
                                        onPress={() => setIsEditMode(false)}
                                    >
                                        <Text style={{ color: '#fff' }}>تراجع</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View style={{ gap: 12, marginVertical: 12 }}>
                                <TouchableOpacity
                                    style={{ backgroundColor: 'rgba(200,168,78,0.15)', borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}
                                    onPress={() => setIsEditMode(true)}
                                >
                                    <Text style={{ fontSize: 20 }}>✏️</Text>
                                    <Text style={{ color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 }}>تعديل الرسالة</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 6 }}
                                    onPress={() => setSelectedMsgForOptions(null)}
                                >
                                    <Text style={{ color: '#fff' }}>إلغاء</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            )}

            {/* modal المكالمة الصوتية اللاسلكية من داخل التطبيق */}
            {activeCallMember && (
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { alignItems: 'center', paddingVertical: 32, backgroundColor: '#0f172a' }]}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                            {activeCallMember.avatar_url ? (
                                <Image source={{ uri: activeCallMember.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                            ) : (
                                <Text style={{ fontSize: 36, color: '#0a0e17', fontWeight: '700' }}>{activeCallMember.full_name?.[0] || '👮'}</Text>
                            )}
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 }}>{activeCallMember.full_name}</Text>
                        <Text style={{ fontSize: 13, color: COLORS.primary, marginBottom: 12 }}>{activeCallMember.rank || 'ضابط'} • الرقم الإحصائي {activeCallMember.statistical_number}</Text>
                        <Text style={{ fontSize: 14, color: COLORS.accent, fontWeight: '600', marginBottom: 24 }}>
                            {callTimer > 0 ? `📶 متصل لاسلكي - ${formatCallDuration(callTimer)}` : 'جاري الاتصال اللاسلكي الفوري المشفر...'}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 28 }}>
                            <TouchableOpacity
                                style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: callMuted ? '#e74c3c' : 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}
                                onPress={() => setCallMuted(!callMuted)}
                            >
                                <Text style={{ fontSize: 22 }}>{callMuted ? '🔇' : '🎙️'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: callSpeaker ? COLORS.primary : 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' }}
                                onPress={() => setCallSpeaker(!callSpeaker)}
                            >
                                <Text style={{ fontSize: 22 }}>🔊</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={{ backgroundColor: '#e74c3c', width: '80%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
                            onPress={() => setActiveCallMember(null)}
                        >
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>إنهاء المكالمة 🔴</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },

    // الرأس
    header: {
        backgroundColor: COLORS.headerBg,
        paddingTop: 50,
        paddingBottom: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: 'rgba(200,168,78,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: {
        fontSize: 18,
        color: COLORS.primary,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    headerSubtitle: {
        fontSize: 11,
        color: COLORS.textMuted,
    },
    lockIcon: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockText: {
        fontSize: 16,
    },

    // شريط التشفير
    encryptionBanner: {
        backgroundColor: 'rgba(200,168,78,0.06)',
        paddingVertical: 6,
        alignItems: 'center',
    },
    encryptionText: {
        fontSize: 10,
        color: COLORS.textMuted,
        letterSpacing: 0.3,
    },

    // الدردشة
    chatArea: {
        flex: 1,
    },
    messagesList: {
        paddingVertical: 12,
    },

    // شريط الإدخال
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 10,
        paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        backgroundColor: COLORS.inputBg,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        gap: 10,
    },
    textInput: {
        flex: 1,
        backgroundColor: COLORS.bg,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: COLORS.textPrimary,
        fontSize: 15,
        maxHeight: 100,
        textAlign: 'right',
        writingDirection: 'rtl',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    sendBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: COLORS.sendBtn,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        opacity: 0.4,
    },
    sendBtnText: {
        fontSize: 18,
        color: COLORS.bg,
        transform: [{ rotate: '180deg' }],
    },

    // الحالة الفارغة
    emptyChatOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 70,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyChat: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyChatIcon: {
        fontSize: 40,
        marginBottom: 12,
        opacity: 0.5,
    },
    emptyChatText: {
        fontSize: 14,
        color: COLORS.textMuted,
        textAlign: 'center',
        lineHeight: 22,
    },

    // أخطاء
    errorTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 8,
        textAlign: 'center',
    },
    errorSub: {
        fontSize: 13,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
    },
    retryBtn: {
        backgroundColor: 'rgba(200,168,78,0.15)',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    retryText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: COLORS.textMuted,
    },

    // أنماط نافذة الأعضاء
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 1000,
    },
    modalContent: {
        width: '100%',
        backgroundColor: '#1a2332',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(200,168,78,0.1)',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    closeBtn: {
        fontSize: 18,
        color: COLORS.textMuted,
        padding: 4,
    },
    memberRow: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    memberAvatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0a0e17',
    },
    memberInfo: {
        flex: 1,
        alignItems: 'flex-end',
    },
    memberName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    memberMeta: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    callMemberBtn: {
        backgroundColor: 'rgba(46,204,113,0.15)',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(46,204,113,0.3)',
    },
});
