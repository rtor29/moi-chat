// ============================================================
// MOI Chat — Authentication Service
// نظام الدردشة الآمنة — خدمة المصادقة
// ============================================================

import supabase from '../config/supabase';
import { initializeKEK, clearLocalKeys } from '../crypto/e2ee';
import * as SecureStore from 'expo-secure-store';

const AuthService = {
    /**
     * تسجيل دخول الضابط بالرقم الاحصائي وكلمة المرور
     * @param {string} statisticalNumber - الرقم الاحصائي
     * @param {string} password - كلمة المرور
     */
    async login(statisticalNumber, password) {
        // البريد الإلكتروني الداخلي = الرقم الاحصائي@moi.internal
        const email = `${statisticalNumber}@moi.internal`;
        const effectivePassword = password.length < 6 ? password.padEnd(6, '0') : password;

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: effectivePassword,
        });

        if (error) {
            if (error.message === 'Invalid login credentials') {
                throw new Error('الرقم الاحصائي أو كلمة المرور غير صحيحة');
            }
            throw new Error(error.message);
        }

        // تهيئة مفتاح التغليف (KEK) من كلمة المرور
        try {
            const kek = await initializeKEK(password);
            // حفظ أن KEK مُهيَّأ
            await SecureStore.setItemAsync('kek_initialized', 'true');
        } catch (err) {
            console.warn('تحذير: فشل تهيئة KEK:', err.message);
        }

        return data;
    },

    /**
     * تسجيل الخروج
     */
    async logout() {
        await clearLocalKeys();
        await SecureStore.deleteItemAsync('kek_initialized');
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(error.message);
    },

    /**
     * الحصول على الجلسة الحالية
     */
    async getSession() {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) return null;
        return session;
    },

    /**
     * الحصول على المستخدم الحالي
     */
    async getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) return null;
        return user;
    },

    /**
     * جلب بيانات الضابط (الملف الشخصي)
     */
    async getOfficerProfile() {
        const user = await this.getCurrentUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('officers')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();

        if (error) return null;
        return data;
    },

    /**
     * مراقبة تغييرات حالة المصادقة
     * @param {Function} callback - (event, session) => void
     */
    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange(callback);
    },
};

export default AuthService;
