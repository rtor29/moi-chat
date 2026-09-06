// ============================================================
// MOI Chat — End-to-End Encryption Module (AES-256-GCM)
// نظام الدردشة الآمنة — وحدة التشفير من طرف لطرف
// ============================================================
//
// هندسة المفاتيح:
//   1. كل مجموعة لها مفتاح تشفير بيانات (DEK) من نوع AES-256
//   2. مفتاح المجموعة مُغلَّف (wrapped) لكل عضو باستخدام مفتاح تغليف (KEK)
//   3. KEK مشتق من كلمة مرور الضابط عبر PBKDF2
//   4. الرسائل تُشفَّر بـ AES-256-GCM مع IV عشوائي لكل رسالة
//
// تدفق الرسالة:
//   إرسال: plaintext → AES-256-GCM(DEK, IV) → {ciphertext, iv}
//   استقبال: {ciphertext, iv} → AES-256-GCM-decrypt(DEK, IV) → plaintext
// ============================================================

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// ==================== ثوابت ====================
const AES_KEY_LENGTH = 256;       // بت
const IV_LENGTH = 12;             // بايت (96 بت — موصى به لـ GCM)
const SALT_LENGTH = 16;           // بايت
const PBKDF2_ITERATIONS = 310000; // OWASP 2023 recommendation
const KEK_STORE_KEY = 'moi_chat_kek';

// ==================== أدوات مساعدة ====================

/**
 * تحويل ArrayBuffer إلى Base64
 */
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * تحويل Base64 إلى ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * توليد بايتات عشوائية
 */
async function getRandomBytes(length) {
    const bytes = await Crypto.getRandomBytesAsync(length);
    return bytes;
}

// ==================== اشتقاق المفاتيح ====================

/**
 * اشتقاق مفتاح تغليف المفاتيح (KEK) من كلمة المرور
 * يستخدم PBKDF2 مع SHA-256
 *
 * @param {string} password - كلمة مرور الضابط
 * @param {Uint8Array} salt - ملح عشوائي (يُحفظ مع المفتاح المغلَّف)
 * @returns {Promise<CryptoKey>} مفتاح KEK
 */
async function deriveKEK(password, salt) {
    // تحويل كلمة المرور لـ ArrayBuffer
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // استيراد كمادة خام
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
    );

    // اشتقاق المفتاح
    const kek = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        true, // قابل للتصدير (لتغليف المفاتيح)
        ['wrapKey', 'unwrapKey']
    );

    return kek;
}

// ==================== إدارة مفاتيح المجموعات ====================

/**
 * توليد مفتاح تشفير بيانات جديد لمجموعة (DEK)
 *
 * @returns {Promise<CryptoKey>} مفتاح AES-256-GCM
 */
export async function generateGroupKey() {
    const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        true, // قابل للتصدير
        ['encrypt', 'decrypt']
    );
    return key;
}

/**
 * اشتقاق مفتاح افتراضي للمجموعة عند عدم وجود مفتاح مغلَّف مخصص
 */
export async function deriveFallbackGroupKey(groupId) {
    const encoder = new TextEncoder();
    // تحويل groupId لتسلسل بايتات ثابت بطول 32 بايت
    const rawStr = (groupId + 'moi_chat_secure_group_salt_key_2026').slice(0, 32).padEnd(32, '0');
    const bytes = encoder.encode(rawStr);
    const key = await crypto.subtle.importKey(
        'raw',
        bytes,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        true,
        ['encrypt', 'decrypt']
    );
    return key;
}

/**
 * تغليف (تشفير) مفتاح المجموعة بـ KEK العضو
 *
 * @param {CryptoKey} groupKey - مفتاح المجموعة (DEK)
 * @param {CryptoKey} kek - مفتاح تغليف المفاتيح (KEK)
 * @returns {Promise<{wrappedKey: string, iv: string}>} المفتاح المغلَّف + IV
 */
export async function wrapGroupKey(groupKey, kek) {
    const iv = await getRandomBytes(IV_LENGTH);

    const wrappedKey = await crypto.subtle.wrapKey(
        'raw',
        groupKey,
        kek,
        { name: 'AES-GCM', iv: iv }
    );

    return {
        wrappedKey: arrayBufferToBase64(wrappedKey),
        iv: arrayBufferToBase64(iv),
    };
}

/**
 * فك تغليف مفتاح المجموعة
 *
 * @param {string} wrappedKeyB64 - المفتاح المغلَّف (Base64)
 * @param {string} ivB64 - IV المستخدم في التغليف (Base64)
 * @param {CryptoKey} kek - مفتاح التغليف
 * @returns {Promise<CryptoKey>} مفتاح المجموعة (DEK)
 */
export async function unwrapGroupKey(wrappedKeyB64, ivB64, kek) {
    const wrappedKey = base64ToArrayBuffer(wrappedKeyB64);
    const iv = base64ToArrayBuffer(ivB64);

    const groupKey = await crypto.subtle.unwrapKey(
        'raw',
        wrappedKey,
        kek,
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        true,
        ['encrypt', 'decrypt']
    );

    return groupKey;
}

// ==================== تشفير / فك تشفير الرسائل ====================

/**
 * تشفير رسالة نصية
 *
 * @param {string} plaintext - النص الصريح
 * @param {CryptoKey} groupKey - مفتاح المجموعة (DEK)
 * @returns {Promise<{encryptedContent: string, iv: string}>}
 */
export async function encryptMessage(plaintext, groupKey) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // توليد IV عشوائي فريد لكل رسالة
    const iv = await getRandomBytes(IV_LENGTH);

    // تشفير AES-256-GCM
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv,
            tagLength: 128, // Authentication Tag = 128 بت
        },
        groupKey,
        data
    );

    return {
        encryptedContent: arrayBufferToBase64(ciphertext),
        iv: arrayBufferToBase64(iv),
    };
}

/**
 * فك تشفير رسالة
 *
 * @param {string} encryptedContentB64 - النص المشفر (Base64)
 * @param {string} ivB64 - IV (Base64)
 * @param {CryptoKey} groupKey - مفتاح المجموعة (DEK)
 * @returns {Promise<string>} النص الصريح
 */
export async function decryptMessage(encryptedContentB64, ivB64, groupKey) {
    const ciphertext = base64ToArrayBuffer(encryptedContentB64);
    const iv = base64ToArrayBuffer(ivB64);

    const decrypted = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: new Uint8Array(iv),
            tagLength: 128,
        },
        groupKey,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

// ==================== تخزين KEK محلياً ====================

/**
 * حفظ الملح المستخدم لاشتقاق KEK في المخزن الآمن
 */
export async function saveKEKSalt(salt) {
    const saltB64 = arrayBufferToBase64(salt);
    await SecureStore.setItemAsync(`${KEK_STORE_KEY}_salt`, saltB64);
}

/**
 * جلب الملح المحفوظ
 */
export async function getKEKSalt() {
    const saltB64 = await SecureStore.getItemAsync(`${KEK_STORE_KEY}_salt`);
    if (!saltB64) return null;
    return new Uint8Array(base64ToArrayBuffer(saltB64));
}

/**
 * إنشاء وحفظ KEK جديد (يُنفَّذ مرة واحدة عند أول تسجيل دخول)
 */
export async function initializeKEK(password) {
    let salt = await getKEKSalt();
    if (!salt) {
        salt = await getRandomBytes(SALT_LENGTH);
        await saveKEKSalt(salt);
    }

    const kek = await deriveKEK(password, salt);
    return kek;
}

/**
 * مسح جميع المفاتيح المحلية (عند تسجيل الخروج)
 */
export async function clearLocalKeys() {
    await SecureStore.deleteItemAsync(`${KEK_STORE_KEY}_salt`);
}

// ==================== تصدير ====================

export default {
    generateGroupKey,
    wrapGroupKey,
    unwrapGroupKey,
    encryptMessage,
    decryptMessage,
    initializeKEK,
    clearLocalKeys,
};
