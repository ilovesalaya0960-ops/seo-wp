# WordPress AI SEO Automation

ระบบอัตโนมัติสำหรับสร้างเนื้อหา WordPress ด้วย AI (Gemini) พร้อมการเพิ่มประสิทธิภาพ SEO และสร้างภาพประกอบ

## คุณสมบัติ

- 🤖 สร้างเนื้อหาด้วย Gemini AI โดยเน้น SEO
- 🖼️ สร้าง Featured Image อัตโนมัติ
- 🏷️ สร้าง Tags อัตโนมัติ
- 📝 จัดรูปแบบ HTML พร้อมเน้นคีย์เวิร์ดสำคัญ
- 📤 Publish ไปยัง WordPress ได้ทันที

## การติดตั้ง

1. Clone โปรเจค
2. ติดตั้ง dependencies:
```bash
npm install
```

3. สร้างไฟล์ `.env` จาก `.env.example`:
```bash
cp .env.example .env
```

4. แก้ไขค่าใน `.env`:
   - `GEMINI_API_KEY`: API Key จาก Google AI Studio
   - `WORDPRESS_URL`: URL ของเว็บ WordPress
   - `WORDPRESS_USERNAME`: Username WordPress
   - `WORDPRESS_PASSWORD`: Application Password (ไม่ใช่รหัสผ่านปกติ)

## การสร้าง WordPress Application Password

1. เข้าไปที่ WordPress Admin > Users > Profile
2. เลื่อนลงไปที่ "Application Passwords"
3. ใส่ชื่อ Application แล้วคลิก "Add New"
4. Copy password ที่ได้มาใส่ใน `.env`

## การใช้งาน

```bash
npm start
```

โปรแกรมจะถามข้อมูล:
1. หัวข้อที่ต้องการสร้างบทความ
2. ต้องการสร้าง Featured Image หรือไม่
3. ต้องการ Publish ทันทีหรือไม่

## โครงสร้างไฟล์

- `index.js` - ไฟล์หลักสำหรับสร้างเนื้อหาด้วย AI
- `wordpress-api.js` - Module สำหรับติดต่อกับ WordPress REST API
- `.env` - ไฟล์ config (ไม่ commit ขึ้น git)

## Requirements

- Node.js 18+
- WordPress site with REST API enabled
- Gemini API Key