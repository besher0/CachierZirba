# Zirba POS Monorepo

هذا المشروع يحتوي على:
- `backend`: API مبني بـ NestJS + SQLite
- `mobile`: تطبيق React Native (Expo) للكاشير والإدارة مع دعم Offline Sync

## المتطلبات

- Node.js 20+
- npm 10+
- Expo Go على الموبايل أو Android Emulator

## تشغيل الباك اند

```bash
cd backend
npm install
npm run start:dev
```

السيرفر يعمل افتراضياً على:
- `http://localhost:3000`
- كل الـ API تحت prefix: `http://localhost:3000/api`

## تشغيل تطبيق الموبايل

```bash
cd mobile
npm install
npm start
```

ثم افتح Expo Go أو شغل Emulator.

## إعداد رابط الـ API للموبايل

بشكل افتراضي التطبيق يستخدم:
- `http://10.0.2.2:3000/api` (مناسب لـ Android Emulator)

لتغيير الرابط:

```bash
cd mobile
set EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP:3000/api
npm start
```

## أهم الميزات

### 1) كاشير (POS)
- اختيار المحل
- إضافة منتجات للسلة
- تسجيل الطلب
- تسجيل تسوية اليوم (صندوق + حصص)

### 2) إدارة (Admin)
- متابعة الأرباح لكل محل
- متابعة عدد الطلبات والمبيعات
- مشاهدة آخر الطلبات لكل محل

### 3) Offline-first Sync
- إذا ما في نت، الطلبات والتسويات تنحفظ محلياً (AsyncStorage)
- تنضاف على Sync Queue تلقائياً
- عند رجوع النت، التطبيق يرفع العمليات تلقائياً للسيرفر
- الحالة تظهر داخل الواجهة (متصل/أوفلاين + عدد العمليات المؤجلة)

## بنية البيانات في الباك اند

- Stores
- Orders (مع `clientOrderId` لضمان idempotency)
- Daily Settlements (صندوق وحصص لكل يوم ولكل محل)

## API Endpoints الرئيسية

### Stores
- `GET /api/stores`
- `POST /api/stores`

### Orders
- `GET /api/orders`
- `POST /api/orders`

### Daily Settlements
- `GET /api/daily-settlements`
- `POST /api/daily-settlements`

### Admin
- `GET /api/admin/dashboard`
- `GET /api/admin/stores/:storeId/summary`
- `GET /api/admin/stores/:storeId/orders`
- `GET /api/admin/stores/:storeId/daily-settlements`

## ملاحظات

- الباك اند يعمل بـ SQLite ملفه داخل `backend/zirba.db` بعد التشغيل.
- يوجد seed تلقائي لأول تشغيل للمحلات الأساسية.
- التطبيق يعمل حتى بدون اتصال، والمزامنة تتم تلقائياً عند عودة الاتصال.
