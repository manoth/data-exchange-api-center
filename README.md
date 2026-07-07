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

## Charset ภาษาไทยบน MySQL/MariaDB

API Center ใช้ `knex` + `mysql2` สำหรับเชื่อมต่อฐานข้อมูล และสั่ง `SET NAMES` ทุก connection เพื่อให้ภาษาไทยจาก Agent/Control ไม่เพี้ยนบน MySQL/MariaDB โดยเฉพาะ MariaDB 10.x

ค่าแนะนำใน `.env`:

```env
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci
```

ถ้าฐานข้อมูลเดิมสร้างเป็น `utf8` และยังไม่พร้อมแปลงเป็น `utf8mb4` ให้ใช้ชั่วคราวได้:

```env
DB_CHARSET=utf8
DB_COLLATION=utf8_general_ci
```

หลังแก้ charset แล้ว ให้ restart API Center และรอ Agent ส่ง heartbeat ใหม่ ชื่อหน่วยบริการจะถูกส่งขึ้นมาใหม่จาก `opdconfig.hospitalname`

## เทียบข้อมูลการตายกับส่วนกลาง

ระบบนำเข้าและ lookup ฐานข้อมูลคนตายกลางจะ normalize `PID/CID` ก่อนเทียบ เช่น ตัด `.0`, เก็บเฉพาะตัวเลข และเติมศูนย์นำหน้ากรณี Excel ทำเลข 13 หลักตกเหลือ 12 หลัก

หลัง update script นี้บน production:

1. รัน `npm run migrate`
2. restart API Center
3. นำเข้าไฟล์ฐานคนตายกลางใหม่ผ่าน Control เพื่อให้ `PID` ถูก normalize ตาม logic ล่าสุด
4. ให้ Agent แปลงไฟล์ Exchange ใหม่ เพราะผลแปลงเก่าจะไม่คำนวณ lookup ย้อนหลังเอง

## Health Check

```bash
curl http://127.0.0.1:3000/api/health
```

ถ้าระบบพร้อมใช้งานควรได้ response สถานะ API กลับมา

## หมายเหตุสำหรับ Agent v0.1.0 ที่ติดตั้งไปแล้ว

Agent v0.1.0 รุ่นแรกมี enrollment token ฝังอยู่ในตัวโปรแกรมเดิม หาก API Center production ใช้ token คนละค่า Agent จะลงทะเบียน Agent API Key ไม่สำเร็จ และ Control จะไม่เห็นเครื่อง online

เพื่อ migration เครื่องที่ติดตั้งไปแล้ว ให้ API Center รองรับ token เดิมชั่วคราวผ่าน:

```env
AGENT_LEGACY_ENROLLMENT_TOKENS=data-exchange-agent-enroll-dev-token
```

หลังจากเครื่อง Agent ทุกเครื่องได้รับ Agent API Key แล้ว ควรนำ legacy token ออกในการ rollout รอบถัดไป และใช้การจัดการ key รายเครื่องผ่าน Control เป็นหลัก
