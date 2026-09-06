// ============================================================
// MOI Chat — Group Service
// نظام الدردشة الآمنة — خدمة المجموعات
// ============================================================

import supabase from '../config/supabase';

const GroupService = {

    /**
     * جلب المجموعات المخصصة للضابط الحالي
     * @returns {Promise<Array>} قائمة المجموعات مع عدد الأعضاء وآخر رسالة
     */
    async getMyGroups() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        // جلب معرف الضابط
        const { data: officer } = await supabase
            .from('officers')
            .select('id, full_name, rank, department, statistical_number, avatar_url')
            .eq('auth_user_id', user.id)
            .single();

        if (!officer) return [];

        // 1. جلب المجموعات المباشرة التي ينتمي لها الضابط عبر جدول group_members
        const { data: memberData } = await supabase
            .from('group_members')
            .select(`
                group_id,
                role,
                groups (
                    id,
                    group_name,
                    description,
                    department_restriction,
                    is_active,
                    created_at
                )
            `)
            .eq('officer_id', officer.id);

        const groupMap = new Map();

        (memberData || []).forEach(item => {
            if (item.groups && item.groups.is_active !== false) {
                groupMap.set(item.groups.id, {
                    ...item.groups,
                    myRole: item.role,
                    isPrivate: false
                });
            }
        });


        const groups = Array.from(groupMap.values());

        // إضافة عدد الأعضاء لكل مجموعة
        for (const group of groups) {
            const { count } = await supabase
                .from('group_members')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', group.id);

            group.memberCount = count || 0;
        }

        // 2. جلب المحادثات المباشرة مع المشرف أو الضباط الآخرين
        try {
            const { data: directMsgs } = await supabase
                .from('messages')
                .select('*')
                .or(`chat_id.eq.${officer.id},chat_id.ilike.%${officer.id}%,chat_id.eq.${user.id},sender_id.eq.${officer.id}`)
                .order('created_at', { ascending: false });

            if (directMsgs && directMsgs.length > 0) {
                const chatMap = {};
                directMsgs.forEach(m => {
                    const cid = m.chat_id || m.sender_id;
                    if (cid && !groups.some(g => g.id === cid)) {
                        if (!chatMap[cid]) {
                            chatMap[cid] = m;
                        }
                    }
                });

                // جلب اسماء الضباط الآخرين للمحادثات الخاصة
                const otherOfficerIds = [];
                Object.keys(chatMap).forEach(cid => {
                    const lastMsg = chatMap[cid];
                    let otherId = lastMsg.sender_id === officer.id ? null : lastMsg.sender_id;
                    if (!otherId && cid.startsWith('private_')) {
                        const parts = cid.replace('private_', '').split('_');
                        otherId = parts.find(id => id !== officer.id && id !== user.id);
                    }
                    if (otherId && otherId !== 'admin' && !otherOfficerIds.includes(otherId)) {
                        otherOfficerIds.push(otherId);
                    }
                });

                let officersNameMap = {};
                if (otherOfficerIds.length > 0) {
                    try {
                        const { data: offs } = await supabase
                            .from('officers')
                            .select('id, full_name, rank')
                            .in('id', otherOfficerIds);
                        (offs || []).forEach(o => {
                            officersNameMap[o.id] = o;
                        });
                    } catch (e) {}
                }

                Object.keys(chatMap).forEach(cid => {
                    const lastMsg = chatMap[cid];
                    let otherId = lastMsg.sender_id === officer.id ? null : lastMsg.sender_id;
                    if (!otherId && cid.startsWith('private_')) {
                        const parts = cid.replace('private_', '').split('_');
                        otherId = parts.find(id => id !== officer.id && id !== user.id);
                    }

                    const otherOff = officersNameMap[otherId];
                    let displayName = '💬 محادثة خاصة';
                    if (cid.includes('admin') || lastMsg.sender_id === 'admin' || otherId === 'admin') {
                        displayName = '💬 رسائل إدارة النظام (المشرف)';
                    } else if (otherOff) {
                        displayName = `💬 خاص: ${otherOff.rank || ''} ${otherOff.full_name}`;
                    }

                    groups.unshift({
                        id: cid,
                        group_name: displayName,
                        description: lastMsg.content || lastMsg.encrypted_content || 'رسالة جديدة',
                        memberCount: 2,
                        is_active: true,
                        isPrivate: true
                    });
                });
            }
        } catch (e) {
            console.warn('تعذر جلب المحادثات المباشرة:', e);
        }

        return groups;
    },

    /**
     * جلب أعضاء مجموعة
     * @param {string} groupId - معرف المجموعة
     */
    async getGroupMembers(groupId) {
        const { data, error } = await supabase
            .from('group_members')
            .select(`
                officer_id,
                role,
                officers (
                    id,
                    full_name,
                    rank,
                    statistical_number,
                    phone,
                    department,
                    avatar_url,
                    is_active
                )
            `)
            .eq('group_id', groupId);

        if (error) throw new Error(error.message);

        return (data || []).map(item => ({
            ...item.officers,
            groupRole: item.role,
        }));
    },

    /**
     * جلب مفتاح المجموعة المغلَّف للضابط الحالي
     * @param {string} groupId - معرف المجموعة
     */
    async getMyGroupKey(groupId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: officer } = await supabase
            .from('officers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single();

        if (!officer) return null;

        const { data, error } = await supabase
            .from('group_keys')
            .select('encrypted_key, key_version')
            .eq('group_id', groupId)
            .eq('officer_id', officer.id)
            .order('key_version', { ascending: false })
            .limit(1)
            .single();

        if (error) return null;
        return data;
    },
};

export default GroupService;
