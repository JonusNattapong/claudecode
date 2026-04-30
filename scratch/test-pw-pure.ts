
import { chromium } from 'playwright';

async function test() {
  console.log('🧪 ทดสอบ Playwright แบบเพียวๆ...');
  try {
    console.log('🚀 กำลังเปิด Browser...');
    const browser = await chromium.launch({ headless: true });
    console.log('📄 สร้างหน้าใหม่...');
    const page = await browser.newPage();
    console.log('🌐 ไปที่ about:blank...');
    await page.goto('about:blank');
    console.log('✅ สำเร็จ! URL ปัจจุบันคือ:', page.url());
    await browser.close();
    console.log('🎉 Playwright เพียวๆ ทำงานปกติ!');
  } catch (error) {
    console.error('❌ Playwright เพียวๆ ยังเดี้ยง:', error);
  }
}

test();
