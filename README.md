# 🛡️ MOI Chat — نظام الدردشة الآمنة والمشفرة لوزارة الداخلية

![MOI Chat Icon](moi_icon.png)

نظام محادثات فورية عالي الأمان مصمم خصيصاً للقطاعات الأمنية ووزارات الداخلية. يوفر التطبيق تشفيراً تاماً بين الطرفين (**End-to-End Encryption - E2EE**) للرسائل والمحادثات بين الضباط والمجموعات المخولة، مع لوحة تحكم إدارية كاملة لإدارة المستخدمين والمجموعات والصلاحيات.

---

## 📸 نظرة عامة على النظام

يتكون المشروع من ثلاثة مكونات رئيسية:
1. **تطبيق الجوال (Mobile App)**: تطبيق محمول مبني بـ React Native / Expo يدعم أنظمة Android و iOS باللغة العربية كلياً.
2. **لوحة التحكم الإدارية (Web Dashboard)**: لوحة تحكم شبكية للمشرفين لإدارة حسابات الضباط، الرتب، المجموعات، والصلاحيات.
3. **قاعدة البيانات والخدمات السحابية (Supabase Backend)**: قاعدة بيانات PostgreSQL مزودة بـ Row Level Security (RLS) ومحرك Realtime للتحديثات الفورية.

---

## ✨ المميزات الرئيسية

- 🔒 **تشفير طرف لطرف (E2EE)**:
  - تشفير الرسائل على جهاز المستخدم قبل إرسالها باستخدام خوارزمية **AES-256-GCM**.
  - اشتقاق المفاتيح باستخدام **PBKDF2** بـ 310,000 تكرار (معيار OWASP 2023).
  - استخدام IV فريد عشوائي (12-byte) لكل رسالة.
  - خوادم قاعدة البيانات لا تخزن سوى النص المشفر (`encrypted_content`) وناقل التهيئة (IV).

- ⚡ **محادثات فورية (Real-Time Messaging)**:
  - مزامنة لحظية للرسائل والمجموعات باستخدام تقنية WebSockets من Supabase Realtime.

- 🪪 **نظام مصادقة الضباط (Statistical Number Auth)**:
  - تسجيل الدخول للضباط باستخدام **الرقم الإحصائي** وكلمة المرور المشفرة.

- 🏢 **إدارة المجموعات والقطاعات**:
  - إنشاء غرف دردشة مغلقة أو مخصصة لقطاعات/دوائر معينة (Department Restrictions).
  - توزيع الأدوار داخل المجموعة (مشرف Admin / عضو Member).

- 💻 **لوحة تحكم إدارية شاملة**:
  - إضافة وتفعيل/تعطيل حسابات الضباط وتعيين الرتب والدائرة.
  - إنشاء المجموعات وتعيين الأعضاء والمشرفين عليها.

- 📱 **ملف APK جاهز للتثبيت**:
  - يتضمن المشروع ملف `MOI_chat.apk` جاهزاً للتثبيت والتجربة المباشرة على أجهزة Android.

---

## 📁 الهيكل البنيوي للمشروع

```
MOI_chat/
├── MOI_chat.apk                         ← تطبيق الأندرويد المجمع الجاهز للتثبيت
├── moi_icon.png                         ← شعار التطبيق
├── docs/
│   └── ENV_SETUP.md                     ← دليل إعداد البيئة بالتفصيل
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql       ← ملف هجرة قاعدة البيانات (SQL Schema & RLS)
├── web-dashboard/                       ← لوحة التحكم الإدارية (Web)
│   ├── index.html                       ← الصفحة الرئيسية للوحة القيادة
│   ├── css/
│   │   └── styles.css                   ← أنماط الواجهة
│   ├── js/
│   │   ├── config.js                    ← إعدادات ومتغيرات بيئة Supabase
│   │   ├── supabase-client.js           ← عميل الاتصال بـ Supabase
│   │   ├── auth.js                      ← مصادقة المشرفين
│   │   ├── dashboard.js                 ← إحصائيات لوحة التحكم
│   │   ├── officers.js                  ← إدارة حسابات الضباط
│   │   └── groups.js                    ← إدارة المجموعات والصلاحيات
│   └── pages/
│       ├── login.html                   ← صفحة دخول المشرفين
│       ├── officers.html                ← صفحة إدارة الضباط
│       └── groups.html                  ← صفحة إدارة المجموعات
└── mobile-app/                          ← تطبيق الجوال (React Native / Expo)
    ├── App.js                           ← نقطة الدخول الرئيسية للتطبيق
    ├── app.json                         ← إعدادات وتكاوين Expo
    ├── package.json                     ← الاعتماديات والحزم
    └── src/
        ├── config/
        │   └── supabase.js              ← إعدادات الربط مع Supabase
        ├── crypto/
        │   └── e2ee.js                  ← محرك التشفير وفك التشفير (AES-256-GCM)
        ├── services/
        │   ├── authService.js           ← خدمة تسجيل دخول الضباط
        │   ├── chatService.js           ← خدمة إرسال واستقبال الرسائل
        │   └── groupService.js          ← خدمة جلب المجموعات وأعضائها
        ├── hooks/
        │   └── useRealtimeChat.js       ← Hook الاستماع للرسائل الفورية
        ├── screens/
        │   ├── LoginScreen.js           ← شاشة تسجيل الدخول
        │   ├── GroupListScreen.js        ← شاشة قائمة المجموعات
        │   └── ChatScreen.js            ← شاشة الدردشة المشفرة
        └── components/
            ├── MessageBubble.js          ← عنصر عرض فقاعة الرسالة
            └── GroupCard.js             ← عنصر عرض بطاقة المجموعة
```

---

## 🔐 المواصفات الأمنية ومعايير التشفير

| المعيار / الخاصية | التقنية / الخوارزمية | التفاصيل |
|-------------------|----------------------|----------|
| **تشفير الرسائل** | `AES-256-GCM` | تشفير متناظر قوي يوفر التكتم والسلامة (AEAD) |
| **اشتقاق المفاتيح** | `PBKDF2-HMAC-SHA256` | 310,000 تكرار مطبق وفق توصيات OWASP |
| **ناقل التهيئة (IV)** | `Crypto.getRandomBytes` | IV بطول 12-byte عشوائي وفريد لكل رسالة |
| **أمان قاعدة البيانات** | `Row Level Security (RLS)` | عزل تام للبيانات؛ لا يمكن للمستخدم استعلام رسائل مجموعة ليس عضواً فيها |
| **التخزين المحلي** | `Expo SecureStore` | تخزين مفاتيح الجلسات بأمان داخل النواة الآمنة للجهاز (Keystore / Keychain) |

---

## 🚀 دليل التشغيل والتثبيت

### 1️⃣ تهيئة قاعدة البيانات (Supabase)

1. أنشئ مشروعاً جديداً في [Supabase](https://supabase.com).
2. افتح **SQL Editor** وانسخ محتوى الملف [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) واضغط **Run**.
3. قم بإنشاء أول حساب مشرف في **Authentication → Users** ثم اضف الـ `UID` في جدول `admin_users`.
4. فعّل الـ Realtime لجدول `messages` في **Database → Replication**.

---

### 2️⃣ تشغيل لوحة التحكم (Web Dashboard)

1. افتح الملف [`web-dashboard/js/config.js`](web-dashboard/js/config.js).
2. ضع مفاتيح Supabase الخاصة بمشروعك (`SUPABASE_URL` و `SUPABASE_ANON_KEY`).
3. قم بتشغيل الخادم المحلي:
```bash
cd web-dashboard
npx serve .
```
4. افتح المتصفح على `http://localhost:3000` وسجّل الدخول بحساب المشرف.

---

### 3️⃣ تشغيل تطبيق الجوال (Mobile App)

1. افتح الملف [`mobile-app/src/config/supabase.js`](mobile-app/src/config/supabase.js) وضع الرابط والمفتاح الخاص بمشروعك.
2. ثبّت الاعتماديات وتشغيل التطبيق:
```bash
cd mobile-app
npm install
npx expo start
```
3. لتشغيل التطبيق على محاكي Android مباشرة:
```bash
npx expo start --android
```

---

## 📲 تثبيت تطبيق Android المباشر (APK)

يمكنك تجربة التطبيق مباشرة على أي جهاز Android عن طريق نقل وتثبيت الملف:
📍 **[`MOI_chat.apk`](MOI_chat.apk)** الموجود في الجذر الرئيسي للمشروع.

---

## 🛠️ التقنيات المستخدمة

- **Frontend (Mobile)**: React Native, Expo, React Navigation
- **Frontend (Web)**: HTML5, CSS3, JavaScript (ES6+), Bootstrap/Tailwind
- **Backend / Database**: Supabase, PostgreSQL, PL/pgSQL
- **Security / Crypto**: Web Crypto API, Expo Crypto, PBKDF2, AES-GCM
- **Realtime**: Supabase Realtime (WebSockets)

---

## 📜 الترخيص والدعم

هذا المشروع مصمم ومطور خصيصاً للتطبيقات والقطاعات ذات المتطلبات الأمنية العالية.
للمزيد من التفاصيل والمعلومات التفصيلية عن البيئة، يرجى مراجعة [دليل إعداد البيئة `docs/ENV_SETUP.md`](docs/ENV_SETUP.md).
