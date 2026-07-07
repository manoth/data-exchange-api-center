# Data Exchange API Center

API Center เป็น backend กลางของระบบ Data Exchange ใช้สื่อสารระหว่าง Agent ที่ติดตั้งในหน่วยบริการ และ Control Dashboard สำหรับผู้ดูแลระบบ

## ส่วนประกอบหลัก

- Agent registration และ Agent API Key รายเครื่อง
- Heartbeat สำหรับสถานะ online/offline
- Command queue สำหรับส่งคำสั่งจาก Control ไปยัง Agent
- Import ฐานข้อมูลคนตายกลางจาก Excel
- Lookup ฐานข้อมูลคนตายกลางให้ Agent ใช้ตอนแปลงข้อมูล
- Dashboard API สำหรับ Control

## สิ่งที่ไม่ควร commit

ห้ามนำไฟล์เหล่านี้ขึ้น GitHub:

- `.env`
- `node_modules/`
- `dist/`
- log, upload, export หรือไฟล์ข้อมูลจริง

ไฟล์ตัวอย่างสำหรับตั้งค่าใช้ `.env.example` เท่านั้น และต้องเปลี่ยนค่า secret จริงบน server

## เริ่มใช้งานบนเครื่องพัฒนา

```bash
cp .env.example .env
npm ci
npm run migrate
npm run dev
```

API จะรันที่ `http://127.0.0.1:3000` ตามค่า `PORT`

## คำสั่งสำคัญ

```bash
npm run dev      # รันแบบ development
npm run build    # build TypeScript เป็น JavaScript ใน dist/
npm run start    # รันไฟล์ build แล้ว
npm run migrate  # สร้าง/ปรับ schema ฐานข้อมูล
```

## Health Check

```bash
curl http://127.0.0.1:3000/api/health
```

ถ้าระบบพร้อมใช้งานควรได้ response สถานะ API กลับมา
