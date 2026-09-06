# دليل إعداد البيئة — MOI Chat
# Environment Setup Guide

---

## 1. إنشاء مشروع Supabase

### الخطوات:
1. اذهب إلى [supabase.com](https://supabase.com) وأنشئ حساباً
2. اضغط **New Project** وحدد:
   - **Project Name**: `moi-chat`
   - **Database Password**: اختر كلمة مرور قوية واحفظها
   - **Region**: اختر أقرب منطقة (مثلاً `Middle East (Bahrain)`)
3. انتظر حتى يكتمل إنشاء المشروع (دقيقة تقريباً)

### جمع المفاتيح:
بعد إنشاء المشروع، اذهب إلى **Settings → API** وانسخ:

| المفتاح | الموقع | الاستخدام |
|---------|--------|---------|
| `Project URL` | Settings → API | `SUPABASE_URL` |
| `anon public` | Settings → API → Project API Keys | `SUPABASE_ANON_KEY` |
| `service_role` | Settings → API → Project API Keys | `SUPABASE_SERVICE_ROLE_KEY` |

> ⚠️ **تحذير أمني**: مفتاح `service_role` يتجاوز جميع سياسات RLS.
> لا تستخدمه أبداً في التطبيق المحمول أو في الكود المواجه للمستخدم.

---

## 2. تنفيذ هجرة قاعدة البيانات

### عبر واجهة Supabase:
1. اذهب إلى **SQL Editor** في لوحة تحكم Supabase
2. افتح ملف `supabase/migrations/001_initial_schema.sql`
3. انسخ المحتوى والصقه في المحرر
4. اضغط **Run** لتنفيذ الهجرة

### عبر CLI (اختياري):
```bash
# تثبيت Supabase CLI
npm install -g supabase

# ربط المشروع
supabase link --project-ref YOUR_PROJECT_ID

# تنفيذ الهجرة
supabase db push
```

### إنشاء أول مشرف:
1. اذهب إلى **Authentication → Users** في Supabase
2. اضغط **Add User** → **Create new user**
   - Email: `admin@moi.gov`
   - Password: اختر كلمة مرور قوية
3. انسخ **User UID** للمستخدم الجديد
4. اذهب إلى **SQL Editor** ونفذ:

```sql
INSERT INTO admin_users (id, email, full_name, role)
VALUES (
    'USER_UID_HERE',  -- استبدل بـ UUID المستخدم
    'admin@moi.gov',
    'مشرف النظام',
    'super_admin'
);
```

---

## 3. إعداد لوحة التحكم (Web Dashboard)

### تعديل متغيرات البيئة:
افتح ملف `web-dashboard/js/config.js` وعدّل:

```javascript
const MOI_CONFIG = {
    SUPABASE_URL: 'https://haacofehkiybrujcltur.supabase.co',    // ← تم ربط مشروعك
    SUPABASE_ANON_KEY: 'eyJ...',                               // ← مفتاح العميل
    SUPABASE_SERVICE_ROLE_KEY: 'eyJ...',                       // ← مفتاح المشرف
    // ...
};
```

### تشغيل لوحة التحكم:
```bash
# الطريقة 1: فتح مباشر
# افتح web-dashboard/index.html في المتصفح

# الطريقة 2: خادم محلي (موصى به)
cd web-dashboard
npx serve .

# الطريقة 3: Live Server في VS Code
# انقر بزر الفأرة الأيمن على index.html → Open with Live Server
```

### تسجيل الدخول:
- البريد: `admin@moi.gov`
- كلمة المرور: التي اخترتها في الخطوة 2

---

## 4. إعداد التطبيق المحمول (Mobile App)

### تعديل متغيرات البيئة:
افتح ملف `mobile-app/src/config/supabase.js` وعدّل:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';   // ← عدّل
const SUPABASE_ANON_KEY = 'eyJ...';                            // ← عدّل
```

### تثبيت الحزم وتشغيل التطبيق:
```bash
cd mobile-app

# تثبيت الحزم
npm install

# تشغيل التطبيق
npx expo start

# أو مباشرة على Android/iOS
npx expo start --android
npx expo start --ios
```

### تسجيل الدخول كضابط:
1. أولاً: سجّل ضابطاً من لوحة التحكم (ستحصل على بيانات الدخول)
2. في التطبيق المحمول:
   - الرقم الاحصائي: الرقم المسجل في لوحة التحكم
   - كلمة المرور: الكلمة المعروضة عند التسجيل

---

## 5. تفعيل Realtime

1. اذهب إلى **Database → Replication** في Supabase
2. تأكد من تفعيل **Realtime** لجدول `messages`
3. أو نفذ في SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

---

## 6. قائمة التحقق الأمني (للإنتاج)

- [ ] **RLS مفعّل** على جميع الجداول (6 جداول)
- [ ] **مفتاح `service_role`** لا يُكشف أبداً في الكود المحمول
- [ ] **HTTPS فقط** — لا يوجد اتصال HTTP غير مشفر
- [ ] **سياسات RLS** مختبرة بحسابات ضباط مختلفة
- [ ] **التشفير E2EE** يعمل — التحقق من أن `encrypted_content` في الجدول غير مقروء
- [ ] **مفاتيح التشفير** لا تُنقل كنص صريح أبداً
- [ ] **PBKDF2** بـ 310,000 تكرار (OWASP 2023)
- [ ] **IV فريد** لكل رسالة (12 بايت عشوائي)
- [ ] **لا بيانات حساسة محلياً** — الجلسة فقط في Secure Store
- [ ] **Edge Functions** بدلاً من `service_role` في الإنتاج

---

## 7. الهيكل البنيوي للمشروع

```
MOI_chat/
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql      ← هجرة قاعدة البيانات
├── web-dashboard/
│   ├── index.html                       ← الصفحة الرئيسية
│   ├── css/styles.css                   ← الأنماط
│   ├── js/
│   │   ├── config.js                    ← ← متغيرات البيئة (عدّل هنا)
│   │   ├── supabase-client.js           ← عميل Supabase
│   │   ├── auth.js                      ← مصادقة المشرف
│   │   ├── dashboard.js                 ← لوحة القيادة
│   │   ├── officers.js                  ← إدارة الضباط
│   │   └── groups.js                    ← إدارة المجموعات
│   └── pages/
│       ├── login.html                   ← تسجيل الدخول
│       ├── officers.html                ← صفحة الضباط
│       └── groups.html                  ← صفحة المجموعات
├── mobile-app/
│   ├── App.js                           ← نقطة الدخول
│   ├── package.json                     ← الحزم
│   ├── app.json                         ← إعدادات Expo
│   └── src/
│       ├── config/supabase.js           ← ← متغيرات البيئة (عدّل هنا)
│       ├── crypto/e2ee.js               ← تشفير AES-256-GCM
│       ├── services/
│       │   ├── authService.js           ← خدمة المصادقة
│       │   ├── chatService.js           ← خدمة الدردشة
│       │   └── groupService.js          ← خدمة المجموعات
│       ├── hooks/useRealtimeChat.js     ← الدردشة الفورية
│       ├── screens/
│       │   ├── LoginScreen.js           ← شاشة الدخول
│       │   ├── GroupListScreen.js        ← قائمة المجموعات
│       │   └── ChatScreen.js            ← الدردشة المشفرة
│       └── components/
│           ├── MessageBubble.js          ← فقاعة الرسالة
│           └── GroupCard.js             ← بطاقة المجموعة
└── docs/
    └── ENV_SETUP.md                     ← هذا الملف
```

---

## 8. استكشاف الأخطاء الشائعة

| المشكلة | الحل |
|---------|------|
| `Invalid login credentials` | تأكد من صحة البريد/الرقم وكلمة المرور |
| `new row violates RLS policy` | المستخدم ليس مشرفاً أو ليس عضواً في المجموعة |
| `relation does not exist` | نفذ ملف الهجرة أولاً |
| الرسائل لا تصل فورياً | تأكد من تفعيل Realtime لجدول messages |
| `Cannot decrypt message` | مفتاح المجموعة غير صحيح أو لم يتم تخصيصه |
