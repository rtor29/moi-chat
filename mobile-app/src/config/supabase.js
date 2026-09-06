// ============================================================
// MOI Chat — Supabase Client for Mobile
// نظام الدردشة الآمنة — عميل Supabase للتطبيق المحمول
// ============================================================

import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Supabase Project ID: haacofehkiybrujcltur
const SUPABASE_URL = 'https://haacofehkiybrujcltur.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhYWNvZmVoa2l5YnJ1amNsdHVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NjI3MTIsImV4cCI6MjA5MjAzODcxMn0.i2nqqhw7zQOE3xu4ow4CUaKa5VTkgJgjg3_F6afixGM';

// محول التخزين الآمن لـ Supabase Auth
const SecureStoreAdapter = {
    getItem: async (key) => {
        try {
            return await SecureStore.getItemAsync(key);
        } catch {
            return null;
        }
    },
    setItem: async (key, value) => {
        try {
            await SecureStore.setItemAsync(key, value);
        } catch (err) {
            console.error('SecureStore setItem error:', err);
        }
    },
    removeItem: async (key) => {
        try {
            await SecureStore.deleteItemAsync(key);
        } catch (err) {
            console.error('SecureStore removeItem error:', err);
        }
    },
};

// إنشاء عميل Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: SecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});

export default supabase;
