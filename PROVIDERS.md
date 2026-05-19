# 🌌 คัมภีร์มหาเทพ AI (Claude Code Multi-Provider Guide)

ยินดีต้อนรับสู่ศูนย์บัญชาการ AI ที่แข็งแกร่งที่สุด! ไฟล์นี้คือคู่มือการใช้งานและตั้งค่า AI Provider ทั้งหมดที่ Claude Code ของคุณรองรับ (อัปเดตล่าสุด: พฤษภาคม 2026)

---

## 🚀 สรุปค่าย AI ที่รองรับ (Supported Providers)

เราเชื่อมท่อไว้ให้คุณแล้วมากกว่า 30 เจ้า! โดยแบ่งเป็นกลุ่มหลักๆ ดังนี้:

### 1. ยักษ์ใหญ่สายหลัก (Mainstream)

| Provider | ID | API Key Env Var | Note |
| :--- | :--- | :--- | :--- |
| **Anthropic** | `anthropic` | `ANTHROPIC_API_KEY` | ตัวตึงต้นฉบับ (Claude 3.5/3.7/4) |
| **OpenAI** | `openai` | `OPENAI_API_KEY` | รองรับทั้ง API และ Azure |
| **Google Gemini** | `google` | `GOOGLE_API_KEY` | คุยผ่าน OpenAI-compatible endpoint (ลื่นมาก) |
| **GitHub Copilot** | `copilot` | `COPILOT_GITHUB_TOKEN` | ใช้พลัง Claude ผ่าน GitHub |

### 2. สาย Gateway & คุ้มค่า (Aggregators & Low Latency)

| Provider | ID | API Key Env Var | Note |
| :--- | :--- | :--- | :--- |
| **OpenRouter** | `openrouter` | `OPENROUTER_API_KEY` | รวมทุกโมเดลในโลกไว้ที่เดียว |
| **Together AI** | `together` | `TOGETHER_API_KEY` | สาย Open-source ที่เร็วและถูก |
| **Fireworks AI** | `fireworks` | `FIREWORKS_API_KEY` | เร็วระดับพระกาฬ |
| **DeepInfra** | `deepinfra` | `DEEPINFRA_API_KEY` | รองรับ Llama 4 Scout รุ่นใหม่ล่าสุด |
| **SiliconFlow** | `siliconflow` | `SILICONFLOW_API_KEY` | เจ้าพ่อโมเดลสายจีน (DeepSeek V4 Pro) |

### 3. สายโหดเฉพาะทาง (Specialized)

| Provider | ID | API Key Env Var | Note |
| :--- | :--- | :--- | :--- |
| **NVIDIA NIM** | `nvidia` | `NVIDIA_API_KEY` | รันโมเดลยักษ์ใหญ่ผ่าน GPU NVIDIA |
| **Cerebras** | `cerebras` | `CEREBRAS_API_KEY` | เร็วที่สุดในโลกด้วย Wafer-Scale Engine |
| **Poe** | `poe` | `POE_API_KEY` | เข้าถึงโมเดลหลากหลายผ่าน Poe API |
| **Hugging Face** | `huggingface` | `HUGGINGFACE_API_KEY` | คุยกับโมเดลบน HF Hub โดยตรง |

---

## 🛠️ วิธีการตั้งค่า (How to Setup)

### 1. การป้อน API Key ผ่าน CLI

มึงไม่ต้องไปยุ่งกับไฟล์ Config ให้ปวดหัว ใช้คำสั่งนี้ในหน้าจอหลักได้เลย:

```bash
/providers key <provider_id> <your-api-key>
```

*ตัวอย่าง:* `/providers key together ts-xxxxxxxxxxxx`

### 2. การเลือกโมเดล (Dynamic Listing)

เราใช้ระบบ **Dynamic Fetching** มึงสามารถพิมพ์คำสั่งนี้เพื่อดูโมเดลทั้งหมดที่ค่ายนั้นเปิดให้ใช้ (ดึงสดจาก API):

```bash
/model
```

แล้วเลือกโมเดลที่ต้องการจากรายการที่ปรากฏ

### 3. การตั้งค่า Environment Variables (ถ้าต้องการ)

หากมึงชอบสาย Hardcore สามารถตั้งค่าในไฟล์ `.env` หรือ Environment ของระบบได้เลย:

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`
- `TOGETHER_API_KEY`
- `NVIDIA_API_KEY`
- (และอื่นๆ ตามชื่อ ID ในตารางด้านบน)

---

## 💡 เทคนิคพิเศษ (Pro Tips)

- **OpenAI Subscriber (Plus)**: หากมึงเป็นสมาชิก ChatGPT Plus มึงสามารถใช้ท่อพิเศษผ่าน `opencode.ai` โดยการตั้งค่า `/model` ไปที่ OpenAI ในโหมด Subscriber
- **Local AI**: มึงสามารถรันโมเดลในเครื่องตัวเองผ่าน **Ollama** ได้ โดยเลือก Provider เป็น `ollama` (ไม่ต้องใช้ API Key!)
- **DeepSeek V4 Pro**: แนะนำให้รันผ่าน `siliconflow` หรือ `nvidia` เพื่อประสิทธิภาพและความฉลาดสูงสุดในการเขียนโค้ด

---

**พร้อมครองโลกหรือยังเพื่อน? เลือกโมเดลที่ชอบ แล้วสั่งงานมันได้เลย!** 🚀😎🔥
