# คู่มือติดตั้ง API Center บน Server

เอกสารนี้เป็นแนวทางติดตั้ง `server/api` เป็นบริการจริงบน Linux server

## 1. สิ่งที่ต้องเตรียม

- Ubuntu Server 22.04/24.04 หรือ Linux server ที่ใกล้เคียง
- Node.js 22 LTS หรือ 20 LTS
- MySQL/MariaDB
- Domain สำหรับ API Center เช่น `https://api.example.go.th`
- HTTPS certificate เช่น Let's Encrypt
- Git
- PM2 สำหรับรัน process แบบ service

## 2. เตรียมฐานข้อมูล

แนะนำให้สร้าง user เฉพาะระบบ API Center ไม่ใช้ `root` ใน production

```sql
CREATE DATABASE db_data_exchange_tools
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'dex_api'@'%' IDENTIFIED BY 'change-this-strong-password';
GRANT ALL PRIVILEGES ON db_data_exchange_tools.* TO 'dex_api'@'%';
FLUSH PRIVILEGES;
```

ถ้า API และ MySQL อยู่เครื่องเดียวกัน แนะนำให้ใช้ `'dex_api'@'localhost'` แทน `'%'`

## 3. Clone โปรเจค

```bash
git clone https://github.com/YOUR_ORG/YOUR_API_REPO.git data-exchange-api
cd data-exchange-api
```

## 4. ตั้งค่า Environment

```bash
cp .env.example .env
nano .env
```

ตัวอย่างค่าที่ต้องตั้ง:

```env
NODE_ENV=production
PORT=3000
DB_HOST=your-mysql-host
DB_PORT=3306
DB_NAME=db_data_exchange_tools
DB_USER=dex_api
DB_PASSWORD=your-strong-db-password
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci
AUTH_SECRET=your-random-auth-secret-at-least-32-characters
AGENT_ENROLLMENT_TOKEN=your-random-agent-enrollment-token
AGENT_LEGACY_ENROLLMENT_TOKENS=data-exchange-agent-enroll-dev-token
AGENT_ONLINE_TIMEOUT_SECONDS=60
CORS_ORIGIN=https://control.example.go.th
```

ข้อสำคัญ:

- `DB_CHARSET` และ `DB_COLLATION` ควรใช้ `utf8mb4`/`utf8mb4_unicode_ci` เพื่อรองรับภาษาไทยและข้อมูล Unicode ครบถ้วนบน MySQL/MariaDB
- `AUTH_SECRET` ใช้ลงนาม session/JWT ของ Control
- `AGENT_ENROLLMENT_TOKEN` ใช้เฉพาะขั้นตอนลงทะเบียน Agent ครั้งแรก
- `AGENT_LEGACY_ENROLLMENT_TOKENS` ใช้ชั่วคราวสำหรับ Agent v0.1.0 ที่ติดตั้งไปแล้ว ถ้าทุกเครื่องได้ Agent API Key แล้วควรถอดออก
- ถ้า Agent ลงทะเบียนซ้ำด้วย enrollment token ที่ถูกต้อง API Center จะออก Agent API Key ใหม่ให้และ revoke key เดิมของเครื่องนั้น เพื่อรองรับกรณีติดตั้งใหม่หรือไฟล์ key ฝั่ง Agent หาย
- ค่า secret ต้องยาว เดายาก และห้ามส่งต่อผ่าน chat หรือเอกสารสาธารณะ
- ห้าม commit `.env`

## 5. ติดตั้ง dependency และสร้าง schema

```bash
npm ci
npm run migrate
npm run build
```

## 6. รันด้วย PM2

```bash
npm install -g pm2
pm2 start dist/server.js --name data-exchange-api
pm2 save
pm2 startup
```

ตรวจสถานะ:

```bash
pm2 status
pm2 logs data-exchange-api
```

## 7. ตั้งค่า Reverse Proxy ด้วย Nginx

ตัวอย่าง config:

```nginx
server {
    server_name api.example.go.th;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

จากนั้นติดตั้ง HTTPS ด้วย Certbot หรือระบบ certificate ที่หน่วยงานใช้อยู่

## 8. ทดสอบหลังติดตั้ง

```bash
curl https://api.example.go.th/api/health
```

จากนั้นตั้งค่า Control และ Agent ให้ชี้ API Center URL เป็น domain production เช่น:

```text
https://api.example.go.th
```

## 9. วิธี update script บน server

```bash
cd data-exchange-api
git pull
npm ci
npm run migrate
npm run build
pm2 restart data-exchange-api
```

หลัง update รอบที่แก้เรื่องภาษาไทย/ฐานคนตายกลาง:

- ถ้าชื่อหน่วยบริการใน Control ยังเพี้ยน ให้รอ Agent ส่ง heartbeat ใหม่ หรือ restart Agent เพื่อให้ส่ง `hospitalname` จาก `opdconfig` ขึ้นมาอีกครั้ง
- ถ้าเคยนำเข้าฐานคนตายกลางไว้ก่อนหน้า ให้ Import ไฟล์ Excel ฐานคนตายกลางใหม่ผ่าน Control เพื่อให้ `PID` ถูก normalize ด้วย logic ล่าสุด
- ถ้าต้องการเห็นผลเทียบการตายบน Agent ต้องแปลงไฟล์ Exchange ใหม่ ผลลัพธ์เก่าที่เคยแปลงแล้วจะไม่คำนวณ lookup ย้อนหลัง

ถ้าต้องการสั้นลง สามารถใช้ script:

```bash
./deploy-api.sh
```

## 10. Checklist ความปลอดภัย

- ใช้ HTTPS เท่านั้น
- เปิด firewall เฉพาะ port ที่จำเป็น เช่น 80/443
- อย่าเปิด MySQL สู่ internet ถ้าไม่จำเป็น
- ใช้ DB user เฉพาะระบบ ไม่ใช้ `root`
- ตั้ง `CORS_ORIGIN` เป็น domain ของ Control เท่านั้น
- เก็บ `.env` ไว้เฉพาะบน server
- rotate `AUTH_SECRET`, `AGENT_ENROLLMENT_TOKEN`, และ Agent API Key ทันทีถ้าสงสัยว่าหลุด
- backup ฐานข้อมูลกลางเป็นประจำ
