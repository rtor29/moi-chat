// ============================================================
// MOI Chat — Main Application Entry Point
// نظام الدردشة الآمنة — نقطة الدخول الرئيسية
// ============================================================

import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/LoginScreen';
import GroupListScreen from './src/screens/GroupListScreen';
import ChatScreen from './src/screens/ChatScreen';
import AuthService from './src/services/authService';
import { translations } from './src/i18n/translations';

import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

const Stack = createNativeStackNavigator();

// ==================== سمة التنقل الداكنة ====================
import { DarkTheme as DefaultDarkTheme } from '@react-navigation/native';

const DarkTheme = {
    ...DefaultDarkTheme,
    dark: true,
    colors: {
        ...DefaultDarkTheme.colors,
        primary: '#c8a84e',
        background: '#0a0e17',
        card: '#111827',
        text: '#f0f2f5',
        border: 'rgba(200,168,78,0.15)',
        notification: '#c8a84e',
    },
};

// ==================== حاوي الأخطاء العام ====================
class ErrorBoundary extends React.Component {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('App ErrorBoundary caught an error:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <View style={{ flex: 1, backgroundColor: '#0a0e17', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <StatusBar style="light" />
                    <Text style={{ color: '#e74c3c', fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>حدث خطأ أثناء التشغيل</Text>
                    <Text style={{ color: '#f0f2f5', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                        {this.state.error?.toString()}
                    </Text>
                    <TouchableOpacity
                        style={{ backgroundColor: '#c8a84e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
                        onPress={() => this.setState({ hasError: false, error: null })}
                    >
                        <Text style={{ color: '#0a0e17', fontWeight: 'bold' }}>إعادة المحاولة</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return this.props.children;
    }
}

export default function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [lang, setLang] = useState('ar');

    const t = translations[lang] || translations.ar;
    const toggleLang = () => setLang(prev => prev === 'ar' ? 'en' : 'ar');

    // التحقق من الجلسة عند فتح التطبيق
    useEffect(() => {
        let isMounted = true;

        const hideSplash = () => {
            SplashScreen.hideAsync().catch(() => {});
        };

        // إخفاء شاشة الشعار فوراً
        hideSplash();

        AuthService.getSession()
            .then(session => {
                if (isMounted && session) {
                    setIsLoggedIn(true);
                }
            })
            .catch(() => {})
            .finally(() => {
                if (isMounted) hideSplash();
            });

        // مؤشر أمان لإخفاء الشعار خلال 1 ثانية في كل الأحوال
        const safetyTimer = setTimeout(() => {
            if (isMounted) hideSplash();
        }, 1000);

        // مراقبة تغييرات المصادقة
        const { data: { subscription } } = AuthService.onAuthStateChange(
            (event, session) => {
                if (isMounted) {
                    if (event === 'SIGNED_IN') {
                        setIsLoggedIn(true);
                    } else if (event === 'SIGNED_OUT') {
                        setIsLoggedIn(false);
                    }
                }
            }
        );

        return () => {
            isMounted = false;
            clearTimeout(safetyTimer);
            subscription?.unsubscribe();
        };
    }, []);

    return (
        <ErrorBoundary>
            <NavigationContainer theme={DarkTheme}>
                <StatusBar style="light" />

                {isLoggedIn ? (
                    // ========== المستخدم مسجل الدخول ==========
                    <Stack.Navigator
                        screenOptions={{
                            headerShown: false,
                            animation: lang === 'ar' ? 'slide_from_left' : 'slide_from_right',
                        }}
                    >
                        <Stack.Screen name="Groups">
                            {(props) => (
                                <GroupListScreen
                                    {...props}
                                    lang={lang}
                                    toggleLang={toggleLang}
                                    t={t}
                                    onLogout={() => setIsLoggedIn(false)}
                                />
                            )}
                        </Stack.Screen>

                        <Stack.Screen name="Chat">
                            {(props) => (
                                <ChatScreen
                                    {...props}
                                    lang={lang}
                                    toggleLang={toggleLang}
                                    t={t}
                                />
                            )}
                        </Stack.Screen>
                    </Stack.Navigator>
                ) : (
                    // ========== المستخدم غير مسجل الدخول ==========
                    <Stack.Navigator screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="Login">
                            {(props) => (
                                <LoginScreen
                                    {...props}
                                    lang={lang}
                                    toggleLang={toggleLang}
                                    t={t}
                                    onLoginSuccess={() => setIsLoggedIn(true)}
                                />
                            )}
                        </Stack.Screen>
                    </Stack.Navigator>
                )}
            </NavigationContainer>
        </ErrorBoundary>
    );
}

