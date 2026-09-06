import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Audio } from 'expo-av';

const COLORS = {
    bg: '#0a0e17',
    cardBg: '#1a2332',
    primary: '#c8a84e',
    accent: '#2ecc71',
    textPrimary: '#f0f2f5',
    textSecondary: '#8899aa',
    textMuted: '#5a6a7a',
    myBubble: '#1a3a2a',
    otherBubble: '#1a2332',
    errorBubble: '#2a1a1a',
};

export default function MessageBubble({ message, isMe }) {
    const [sound, setSound] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const bubbleStyle = [
        styles.bubble,
        isMe ? styles.myBubble : styles.otherBubble,
        message.isEncryptionError && styles.errorBubble,
    ];

    const isAudio = message.messageType === 'audio' || message.type === 3 || (message.text && (message.text.includes('.webm') || message.text.includes('.m4a') || message.text.includes('.mp3') || message.text.includes('.wav') || message.text.includes('audio/') || message.text.startsWith('data:audio')));
    const isImage = !isAudio && (message.messageType === 'image' || (message.text && (message.text.startsWith('http') || message.text.startsWith('data:image'))));

    async function playAudio() {
        try {
            if (sound) {
                if (isPlaying) {
                    await sound.pauseAsync();
                    setIsPlaying(false);
                } else {
                    await sound.playAsync();
                    setIsPlaying(true);
                }
            } else {
                const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri: message.text },
                    { shouldPlay: true }
                );
                setSound(newSound);
                setIsPlaying(true);
                newSound.setOnPlaybackStatusUpdate((status) => {
                    if (status.didJustFinish) {
                        setIsPlaying(false);
                    }
                });
            }
        } catch (e) {
            console.warn('خطأ في تشغيل الصوت:', e);
        }
    }

    useEffect(() => {
        return sound
            ? () => {
                sound.unloadAsync();
            }
            : undefined;
    }, [sound]);

    return (
        <View style={[styles.container, isMe ? styles.myContainer : styles.otherContainer]}>
            {!isMe && (
                <View style={styles.senderRow}>
                    <Text style={styles.senderName}>{message.user?.name || 'غير معروف'}</Text>
                    {message.senderRank ? (
                        <Text style={styles.senderRank}>{message.senderRank}</Text>
                    ) : null}
                </View>
            )}

            <View style={bubbleStyle}>
                {isAudio ? (
                    <TouchableOpacity style={styles.audioRow} onPress={playAudio}>
                        <View style={styles.playIconContainer}>
                            <Text style={styles.playIcon}>{isPlaying ? '⏸️' : '▶️'}</Text>
                        </View>
                        <View style={styles.audioTextCol}>
                            <Text style={[styles.audioTitle, isMe ? styles.myText : styles.otherText]}>
                                {isPlaying ? 'جاري الاستماع...' : 'بصمة صوتية 🎤'}
                            </Text>
                            <Text style={styles.audioSub}>اضغط للتشغيل</Text>
                        </View>
                    </TouchableOpacity>
                ) : isImage ? (
                    <Image
                        source={{ uri: message.text }}
                        style={{ width: 200, height: 200, borderRadius: 12, marginBottom: 4 }}
                        resizeMode="cover"
                    />
                ) : (
                    <Text style={[styles.messageText, message.isEncryptionError && styles.errorText]}>
                        {message.text}
                    </Text>
                )}
            </View>

            <Text style={[styles.time, isMe ? styles.timeRight : styles.timeLeft]}>
                {formatTime(message.createdAt)}
                {isMe && ' ✓'}
            </Text>
        </View>
    );
}

function formatTime(date) {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'م' : 'ص';
        const formattedHours = (hours % 12 || 12).toString().padStart(2, '0');
        return `${formattedHours}:${minutes} ${ampm}`;
    } catch (e) {
        return '';
    }
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 4,
        marginHorizontal: 12,
        maxWidth: '80%',
    },
    myContainer: {
        alignSelf: 'flex-end',
    },
    otherContainer: {
        alignSelf: 'flex-start',
    },
    senderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 6,
    },
    senderName: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.primary,
    },
    senderRank: {
        fontSize: 10,
        color: COLORS.textMuted,
        backgroundColor: 'rgba(200,168,78,0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    bubble: {
        borderRadius: 16,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    myBubble: {
        backgroundColor: COLORS.myBubble,
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        backgroundColor: COLORS.otherBubble,
        borderBottomLeftRadius: 4,
    },
    errorBubble: {
        backgroundColor: COLORS.errorBubble,
        borderWidth: 1,
        borderColor: 'rgba(231,76,60,0.3)',
    },
    messageText: {
        fontSize: 15,
        color: COLORS.textPrimary,
        lineHeight: 22,
        writingDirection: 'rtl',
    },
    errorText: {
        fontStyle: 'italic',
        color: COLORS.textMuted,
    },
    time: {
        fontSize: 10,
        color: COLORS.textMuted,
        marginTop: 4,
    },
    timeRight: {
        textAlign: 'right',
    },
    timeLeft: {
        textAlign: 'left',
    },
    audioRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 2,
        paddingHorizontal: 4,
        minWidth: 160,
    },
    playIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(200,168,78,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playIcon: {
        fontSize: 16,
    },
    audioTextCol: {
        flexDirection: 'column',
    },
    audioTitle: {
        fontSize: 13,
        fontWeight: '700',
    },
    myText: {
        color: COLORS.textPrimary,
    },
    otherText: {
        color: COLORS.textPrimary,
    },
    audioSub: {
        fontSize: 10,
        color: COLORS.textSecondary,
    },
});
