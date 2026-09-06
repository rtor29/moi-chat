// ============================================================
// MOI Chat — Group List Screen
// نظام الدردشة الآمنة — شاشة قائمة المجموعات
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet,
    RefreshControl, StatusBar, TouchableOpacity, ActivityIndicator, Image
} from 'react-native';
import GroupCard from '../components/GroupCard';
import GroupService from '../services/groupService';
import AuthService from '../services/authService';

const COLORS = {
    bg: '#0a0e17',
    cardBg: '#1a2332',
    primary: '#c8a84e',
    accent: '#2ecc71',
    textPrimary: '#f0f2f5',
    textSecondary: '#8899aa',
    textMuted: '#5a6a7a',
    border: 'rgba(200,168,78,0.15)',
    headerBg: '#111827',
};

export default function GroupListScreen({ navigation, onLogout, lang, toggleLang, t }) {
    const [groups, setGroups] = useState([]);
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const text = t || {
        ministryGroups: '🛡️ مجموعات الوزارة',
        logout: '🚪 خروج',
        noGroupsTitle: 'لا توجد مجموعات',
        noGroupsDesc: 'لم يتم تخصيص أي مجموعات لحسابك بعد.',
        loading: 'جاري التحميل...',
        langName: 'English 🇺🇸'
    };

    // تحميل البيانات حياً من السيرفر مباشرة
    const loadData = useCallback(async () => {
        try {
            const [groupsData, profileData] = await Promise.all([
                GroupService.getMyGroups(),
                AuthService.getOfficerProfile(),
            ]);
            setGroups(groupsData);
            setProfile(profileData);
        } catch (err) {
            console.error('خطأ تحميل البيانات:', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // سحب للتحديث
    const onRefresh = useCallback(() => {
        setIsRefreshing(true);
        loadData();
    }, [loadData]);

    // الانتقال للدردشة
    const openChat = (group) => {
        navigation.navigate('Chat', {
            groupId: group.id,
            groupName: group.group_name,
            officerId: profile?.id,
        });
    };

    // تسجيل الخروج
    const handleLogout = async () => {
        try {
            await AuthService.logout();
            onLogout();
        } catch (err) {
            console.error('خطأ تسجيل الخروج:', err);
        }
    };

    // الرأس
    const renderHeader = () => (
        <View style={styles.profileCard}>
            <View style={[styles.profileRow, { flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }]}>
                <View style={[styles.avatar, lang === 'ar' ? { marginLeft: 14 } : { marginRight: 14 }]}>
                    {profile?.avatar_url ? (
                        <Image
                            source={{ uri: profile.avatar_url }}
                            style={{ width: 52, height: 52, borderRadius: 26 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <Text style={styles.avatarText}>
                            {profile?.full_name?.[0] || '?'}
                        </Text>
                    )}
                </View>
                <View style={[styles.profileInfo, { alignItems: lang === 'ar' ? 'flex-end' : 'flex-start' }]}>
                    <Text style={styles.profileName}>{profile?.full_name || '—'}</Text>
                    <Text style={styles.profileMeta}>
                        {profile?.rank || ''}{profile?.department ? ` • ${profile.department}` : ''}
                    </Text>
                    <Text style={styles.statNumber}>
                        {profile?.phone ? `📞 ${profile.phone}` : `📋 الرقم الاحصائي: ${profile?.statistical_number || ''}`}
                    </Text>
                </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>{text.logout}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.langBtnHeader} onPress={toggleLang}>
                    <Text style={styles.langBtnHeaderText}>🌐 {text.langName}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // الحالة الفارغة
    const renderEmpty = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>{text.noGroupsTitle}</Text>
            <Text style={styles.emptyText}>{text.noGroupsDesc}</Text>
        </View>
    );

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>جاري التحميل...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.headerBg} />

            {/* الرأس */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>🛡️ مجموعات الوزارة</Text>
                <View style={styles.connectionDot} />
            </View>

            <FlatList
                data={groups}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <GroupCard group={item} onPress={openChat} />
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmpty}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
                        colors={[COLORS.primary]}
                    />
                }
                showsVerticalScrollIndicator={false}
            />
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
    header: {
        backgroundColor: COLORS.headerBg,
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textPrimary,
    },
    connectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.accent,
    },
    listContent: {
        paddingBottom: 24,
    },
    profileCard: {
        margin: 16,
        backgroundColor: COLORS.cardBg,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    profileRow: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 14,
    },
    avatarText: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.bg,
    },
    profileInfo: {
        flex: 1,
        alignItems: 'flex-end',
    },
    profileName: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    profileMeta: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    statNumber: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 4,
    },
    logoutBtn: {
        backgroundColor: 'rgba(231,76,60,0.1)',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(231,76,60,0.2)',
    },
    logoutText: {
        fontSize: 12,
        color: '#e74c3c',
        fontWeight: '600',
    },
    langBtnHeader: {
        backgroundColor: 'rgba(200,168,78,0.12)',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    langBtnHeaderText: {
        fontSize: 12,
        color: COLORS.primary,
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
        opacity: 0.5,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: COLORS.textMuted,
    },
});
