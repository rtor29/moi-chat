// ============================================================
// MOI Chat — GroupCard Component
// نظام الدردشة الآمنة — مكون بطاقة المجموعة
// ============================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const COLORS = {
    cardBg: '#1a2332',
    cardHover: '#1f2b3d',
    primary: '#c8a84e',
    accent: '#2ecc71',
    textPrimary: '#f0f2f5',
    textSecondary: '#8899aa',
    textMuted: '#5a6a7a',
    border: 'rgba(200,168,78,0.15)',
};

export default function GroupCard({ group, onPress }) {
    return (
        <TouchableOpacity
            style={styles.card}
            onPress={() => onPress(group)}
            activeOpacity={0.7}
        >
            <View style={styles.iconContainer}>
                <Text style={styles.icon}>📂</Text>
            </View>

            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                    {group.group_name}
                </Text>
                {group.description ? (
                    <Text style={styles.description} numberOfLines={1}>
                        {group.description}
                    </Text>
                ) : null}
                <View style={styles.meta}>
                    <Text style={styles.memberCount}>
                        👥 {group.memberCount || 0} عضو
                    </Text>
                    {group.department_restriction ? (
                        <Text style={styles.deptBadge}>
                            🏢 {group.department_restriction}
                        </Text>
                    ) : null}
                </View>
            </View>

            <View style={styles.chevron}>
                <Text style={styles.chevronText}>‹</Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBg,
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginVertical: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'rgba(200,168,78,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },
    icon: {
        fontSize: 24,
    },
    info: {
        flex: 1,
        marginLeft: 0,
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
        writingDirection: 'rtl',
        textAlign: 'right',
    },
    description: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
        writingDirection: 'rtl',
        textAlign: 'right',
    },
    meta: {
        flexDirection: 'row-reverse',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    memberCount: {
        fontSize: 12,
        color: COLORS.textMuted,
    },
    deptBadge: {
        fontSize: 10,
        color: COLORS.primary,
        backgroundColor: 'rgba(200,168,78,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    chevron: {
        marginRight: 4,
    },
    chevronText: {
        fontSize: 20,
        color: COLORS.textMuted,
    },
});
