-- ============================================================
-- MOI Chat — Supabase SQL Migration
-- نظام الدردشة الآمنة لوزارة الداخلية
-- ============================================================
-- Tables: officers, groups, group_members, messages, group_keys, admin_users
-- Security: Strict RLS on every table
-- Encryption: Messages store AES-256-GCM ciphertext + IV only
-- ============================================================

-- ==================== EXTENSIONS ====================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== CUSTOM TYPES ====================
CREATE TYPE member_role AS ENUM ('admin', 'member');
CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'system');

-- ==================== TABLES ====================

-- 1. جدول المشرفين (Admin Users)
CREATE TABLE admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'admin', 'moderator')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. جدول الضباط (Officers)
CREATE TABLE officers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    statistical_number TEXT NOT NULL UNIQUE,  -- الرقم الاحصائي
    full_name TEXT NOT NULL,                  -- الاسم الكامل
    rank TEXT NOT NULL DEFAULT 'جندي',        -- الرتبة
    department TEXT NOT NULL DEFAULT '',       -- الدائرة / الوحدة
    phone TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. جدول المجموعات (Groups / Channels)
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    department_restriction TEXT DEFAULT NULL,  -- NULL = open to all departments
    avatar_url TEXT DEFAULT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. جدول أعضاء المجموعات (Group Members — Junction)
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    officer_id UUID NOT NULL REFERENCES officers(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, officer_id)
);

-- 5. جدول الرسائل (Messages — E2EE Encrypted)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES officers(id) ON DELETE CASCADE,
    encrypted_content TEXT NOT NULL,           -- AES-256-GCM ciphertext (Base64)
    iv TEXT NOT NULL,                          -- Initialization Vector (Base64)
    message_type message_type NOT NULL DEFAULT 'text',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. جدول مفاتيح المجموعات (Group Encryption Keys — wrapped per member)
CREATE TABLE group_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    officer_id UUID NOT NULL REFERENCES officers(id) ON DELETE CASCADE,
    encrypted_key TEXT NOT NULL,               -- Group DEK wrapped with officer's KEK
    key_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, officer_id, key_version)
);

-- ==================== INDEXES ====================

-- البحث بالرقم الاحصائي
CREATE INDEX idx_officers_statistical_number ON officers(statistical_number);
CREATE INDEX idx_officers_auth_user_id ON officers(auth_user_id);
CREATE INDEX idx_officers_department ON officers(department);

-- الرسائل: البحث حسب المجموعة والوقت
CREATE INDEX idx_messages_group_created ON messages(group_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- أعضاء المجموعات
CREATE INDEX idx_group_members_officer ON group_members(officer_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);

-- مفاتيح المجموعات
CREATE INDEX idx_group_keys_officer ON group_keys(officer_id);
CREATE INDEX idx_group_keys_group ON group_keys(group_id);

-- ==================== HELPER FUNCTIONS ====================

-- دالة: التحقق من كون المستخدم مشرفاً
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE id = (SELECT auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- دالة: الحصول على معرف الضابط من معرف المصادقة
CREATE OR REPLACE FUNCTION get_officer_id()
RETURNS UUID AS $$
  SELECT id FROM officers WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- دالة: الحصول على معرفات مجموعات الضابط الحالي
CREATE OR REPLACE FUNCTION get_my_group_ids()
RETURNS SETOF UUID AS $$
  SELECT gm.group_id
  FROM group_members gm
  JOIN officers o ON o.id = gm.officer_id
  WHERE o.auth_user_id = (SELECT auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- دالة: التحقق من عضوية الضابط في مجموعة معينة
CREATE OR REPLACE FUNCTION is_member_of(target_group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members gm
    JOIN officers o ON o.id = gm.officer_id
    WHERE o.auth_user_id = (SELECT auth.uid())
      AND gm.group_id = target_group_id
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ==================== TRIGGERS ====================

-- تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_officers_updated_at
    BEFORE UPDATE ON officers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==================== ROW LEVEL SECURITY ====================

-- تفعيل RLS على جميع الجداول
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_keys ENABLE ROW LEVEL SECURITY;

-- ========== سياسات جدول المشرفين (admin_users) ==========

CREATE POLICY "admin_users_select_self"
    ON admin_users FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()));

CREATE POLICY "admin_users_select_admin"
    ON admin_users FOR SELECT TO authenticated
    USING (is_admin());

-- ========== سياسات جدول الضباط (officers) ==========

-- المشرف يرى جميع الضباط
CREATE POLICY "officers_select_admin"
    ON officers FOR SELECT TO authenticated
    USING (is_admin());

-- الضابط يرى بياناته فقط
CREATE POLICY "officers_select_self"
    ON officers FOR SELECT TO authenticated
    USING (auth_user_id = (SELECT auth.uid()));

-- الضابط يرى زملاءه في نفس المجموعات
CREATE POLICY "officers_select_group_peers"
    ON officers FOR SELECT TO authenticated
    USING (
        id IN (
            SELECT gm2.officer_id
            FROM group_members gm1
            JOIN group_members gm2 ON gm1.group_id = gm2.group_id
            JOIN officers o ON o.id = gm1.officer_id
            WHERE o.auth_user_id = (SELECT auth.uid())
        )
    );

-- المشرف فقط يضيف الضباط
CREATE POLICY "officers_insert_admin"
    ON officers FOR INSERT TO authenticated
    WITH CHECK (is_admin());

-- المشرف فقط يعدل الضباط
CREATE POLICY "officers_update_admin"
    ON officers FOR UPDATE TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- المشرف فقط يحذف الضباط
CREATE POLICY "officers_delete_admin"
    ON officers FOR DELETE TO authenticated
    USING (is_admin());

-- ========== سياسات جدول المجموعات (groups) ==========

-- أعضاء المجموعة يرون المجموعة
CREATE POLICY "groups_select_member"
    ON groups FOR SELECT TO authenticated
    USING (
        id IN (SELECT get_my_group_ids())
        OR is_admin()
    );

-- المشرف فقط ينشئ المجموعات
CREATE POLICY "groups_insert_admin"
    ON groups FOR INSERT TO authenticated
    WITH CHECK (is_admin());

-- المشرف فقط يعدل المجموعات
CREATE POLICY "groups_update_admin"
    ON groups FOR UPDATE TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- المشرف فقط يحذف المجموعات
CREATE POLICY "groups_delete_admin"
    ON groups FOR DELETE TO authenticated
    USING (is_admin());

-- ========== سياسات جدول أعضاء المجموعات (group_members) ==========

-- أعضاء المجموعة يرون قائمة الأعضاء
CREATE POLICY "group_members_select"
    ON group_members FOR SELECT TO authenticated
    USING (
        group_id IN (SELECT get_my_group_ids())
        OR is_admin()
    );

-- المشرف فقط يضيف أعضاء
CREATE POLICY "group_members_insert_admin"
    ON group_members FOR INSERT TO authenticated
    WITH CHECK (is_admin());

-- المشرف فقط يعدل الأعضاء
CREATE POLICY "group_members_update_admin"
    ON group_members FOR UPDATE TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- المشرف فقط يحذف الأعضاء
CREATE POLICY "group_members_delete_admin"
    ON group_members FOR DELETE TO authenticated
    USING (is_admin());

-- ========== سياسات جدول الرسائل (messages) — الأهم أمنياً ==========

-- أعضاء المجموعة فقط يقرأون الرسائل
CREATE POLICY "messages_select_member"
    ON messages FOR SELECT TO authenticated
    USING (
        group_id IN (SELECT get_my_group_ids())
    );

-- العضو يرسل رسائل فقط في مجموعاته (ويجب أن يكون هو المرسل)
CREATE POLICY "messages_insert_member"
    ON messages FOR INSERT TO authenticated
    WITH CHECK (
        is_member_of(group_id)
        AND sender_id = (SELECT get_officer_id())
    );

-- الرسائل غير قابلة للتعديل (immutable)
-- لا توجد سياسة UPDATE أو DELETE للرسائل

-- ========== سياسات جدول مفاتيح المجموعات (group_keys) ==========

-- الضابط يرى مفاتيحه فقط
CREATE POLICY "group_keys_select_own"
    ON group_keys FOR SELECT TO authenticated
    USING (
        officer_id = (SELECT get_officer_id())
    );

-- المشرف يرى جميع المفاتيح
CREATE POLICY "group_keys_select_admin"
    ON group_keys FOR SELECT TO authenticated
    USING (is_admin());

-- المشرف فقط ينشئ المفاتيح
CREATE POLICY "group_keys_insert_admin"
    ON group_keys FOR INSERT TO authenticated
    WITH CHECK (is_admin());

-- المشرف فقط يحذف المفاتيح
CREATE POLICY "group_keys_delete_admin"
    ON group_keys FOR DELETE TO authenticated
    USING (is_admin());

-- ==================== REALTIME ====================

-- تفعيل Realtime على جدول الرسائل فقط
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- ==================== SEED DATA (اختياري) ====================

-- يمكنك إضافة بيانات تجريبية هنا بعد إنشاء مستخدم مشرف في Supabase Auth
-- INSERT INTO admin_users (id, email, full_name, role)
-- VALUES ('<auth-user-uuid>', 'admin@moi.gov', 'مشرف النظام', 'super_admin');
