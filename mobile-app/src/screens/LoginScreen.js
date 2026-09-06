// ============================================================
// MOI Chat — Login Screen
// نظام الدردشة الآمنة — شاشة تسجيل الدخول
// ============================================================

import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, StatusBar, Image
} from 'react-native';
import AuthService from '../services/authService';

const COLORS = {
    bg: '#0a0e17',
    cardBg: 'rgba(26,35,50,0.7)',
    primary: '#c8a84e',
    primaryDark: '#a08030',
    accent: '#2ecc71',
    textPrimary: '#f0f2f5',
    textSecondary: '#8899aa',
    textMuted: '#5a6a7a',
    inputBg: '#0f1923',
    border: 'rgba(200,168,78,0.15)',
    error: '#e74c3c',
};

export default function LoginScreen({ onLoginSuccess, lang, toggleLang, t }) {
    const [statisticalNumber, setStatisticalNumber] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const text = t || {
        appName: 'نظام الدردشة الآمنة',
        subTitle: 'وزارة الداخلية — MOI_chat',
        statNumber: 'الرقم الاحصائي',
        statNumPlaceholder: 'مثال: 123456',
        password: 'كلمة المرور',
        loginBtn: 'تسجيل الدخول',
        loginErrorReq: 'يرجى إدخال الرقم الاحصائي وكلمة المرور',
        encryptedFooter: '🛡️ نظام الاتصال الآمن — وزارة الداخلية',
        langName: 'English 🇺🇸'
    };

    const handleLogin = async () => {
        if (!statisticalNumber.trim() || !password) {
            setError(text.loginErrorReq);
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const data = await AuthService.login(statisticalNumber.trim(), password);
            onLoginSuccess(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

            {/* خلفية متوهجة */}
            <View style={styles.glowTopRight} />
            <View style={styles.glowBottomLeft} />

            {/* زر تغيير اللغة */}
            <TouchableOpacity
                style={styles.langBtn}
                onPress={toggleLang}
                activeOpacity={0.7}
            >
                <Text style={styles.langBtnText}>🌐 {text.langName}</Text>
            </TouchableOpacity>

            <View style={styles.card}>
                {/* الشعار */}
                <View style={styles.logoContainer}>
                    <View style={{ width: 84, height: 84, borderRadius: 20, overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: COLORS.border }}>
                        <Image
                            source={require('../../assets/logo.png')}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                        />
                    </View>
                    <Text style={styles.title}>{text.appName}</Text>
                    <Text style={styles.subtitle}>{text.subTitle}</Text>
                </View>

                {/* حقل الرقم الاحصائي */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { textAlign: lang === 'ar' ? 'right' : 'left' }]}>{text.statNumber}</Text>
                    <TextInput
                        style={[styles.input, { textAlign: lang === 'ar' ? 'right' : 'left', writingDirection: lang === 'ar' ? 'rtl' : 'ltr' }]}
                        value={statisticalNumber}
                        onChangeText={setStatisticalNumber}
                        placeholder={text.statNumPlaceholder}
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="numeric"
                        autoCapitalize="none"
                        returnKeyType="next"
                        editable={!isLoading}
                    />
                </View>

                {/* حقل كلمة المرور */}
                <View style={styles.inputGroup}>
                    <Text style={[styles.label, { textAlign: lang === 'ar' ? 'right' : 'left' }]}>{text.password}</Text>
                    <TextInput
                        style={[styles.input, { textAlign: lang === 'ar' ? 'right' : 'left', writingDirection: lang === 'ar' ? 'rtl' : 'ltr' }]}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        placeholderTextColor={COLORS.textMuted}
                        secureTextEntry
                        returnKeyType="go"
                        onSubmitEditing={handleLogin}
                        editable={!isLoading}
                    />
                </View>

                {/* رسالة الخطأ */}
                {error ? (
                    <Text style={styles.error}>{error}</Text>
                ) : null}

                {/* زر تسجيل الدخول */}
                <TouchableOpacity
                    style={[styles.button, isLoading && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator color={COLORS.bg} size="small" />
                    ) : (
                        <Text style={styles.buttonText}>{text.loginBtn}</Text>
                    )}
                </TouchableOpacity>

                {/* تذييل */}
                <Text style={styles.footer}>{text.encryptedFooter}</Text>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    langBtn: {
        position: 'absolute',
        top: 50,
        right: 20,
        backgroundColor: 'rgba(200,168,78,0.12)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        zIndex: 10,
    },
    langBtnText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '700',
    },
    glowTopRight: {
        position: 'absolute',
        top: -80,
        right: -80,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(200,168,78,0.05)',
    },
    glowBottomLeft: {
        position: 'absolute',
        bottom: -60,
        left: -60,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: 'rgba(46,204,113,0.04)',
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: COLORS.cardBg,
        borderRadius: 24,
        padding: 36,
        borderWidth: 1,
        borderColor: 'rgba(200,168,78,0.08)',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    logoEmoji: {
        fontSize: 32,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    inputGroup: {
        marginBottom: 18,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: 8,
        textAlign: 'right',
    },
    input: {
        backgroundColor: COLORS.inputBg,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        color: COLORS.textPrimary,
        fontSize: 15,
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    error: {
        color: COLORS.error,
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 16,
    },
    button: {
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: COLORS.bg,
        fontSize: 16,
        fontWeight: '700',
    },
    footer: {
        textAlign: 'center',
        marginTop: 24,
        fontSize: 11,
        color: COLORS.textMuted,
    },
});
