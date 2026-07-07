# Security Policy

## Secret Handling

โปรเจคนี้ไม่เก็บ secret จริงใน GitHub

ค่าที่เป็นความลับต้องอยู่ใน `.env` บน server เท่านั้น:

- `DB_PASSWORD`
- `AUTH_SECRET`
- `AGENT_ENROLLMENT_TOKEN`
- `AGENT_LEGACY_ENROLLMENT_TOKENS` ถ้าจำเป็นต้องเปิดใช้ช่วง migration
- secret อื่นๆ ที่ใช้เชื่อมต่อระบบภายนอก

API Center จะเก็บ Agent API Key ในฐานข้อมูลแบบ hash และจะแสดง key เต็มเฉพาะตอนออก key ใหม่เท่านั้น

## Production Requirements

- ต้องใช้ HTTPS
- ต้องตั้ง `NODE_ENV=production`
- ต้องตั้ง `AUTH_SECRET` และ `AGENT_ENROLLMENT_TOKEN` เอง
- ใช้ `AGENT_LEGACY_ENROLLMENT_TOKENS` เฉพาะช่วงย้าย Agent รุ่นเก่า และถอดออกเมื่อทุกเครื่องมี key แล้ว
- ต้องใช้ DB user เฉพาะระบบ
- ต้องจำกัด `CORS_ORIGIN` เป็น URL ของ Control

## If a Secret Leaks

1. Revoke/rotate key ที่หลุดทันที
2. เปลี่ยนค่าใน `.env`
3. restart service
4. ตรวจ log และรายการ access ที่ผิดปกติ
5. ถ้า secret เคยถูก commit ต้องลบ history หรือสร้าง repo ใหม่ตามความเหมาะสม
