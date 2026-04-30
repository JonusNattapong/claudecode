
import { handleBrowserAction } from '../src/tools/BrowserTool/handler';

async function test() {
  console.log('🚀 เริ่มต้นการทดสอบ Browser Use (โหมด Safe)...');
  
  try {
    // 1. ลองเข้าหน้าว่างๆ ก่อน
    console.log('🌐 กำลังเปิดหน้าว่าง about:blank...');
    const navResult = await handleBrowserAction({
      action: 'navigate',
      url: 'about:blank',
      headless: true
    });
    console.log('✅ เปิดหน้าว่างสำเร็จ!');

    // 2. ลองเช็กสถานะ
    const status = await handleBrowserAction({ action: 'status' });
    console.log('📊 สถานะปัจจุบัน:', status.url);

    // 3. ปิด Browser
    console.log('🚪 ปิดการเชื่อมต่อ...');
    await handleBrowserAction({ action: 'close' });
    console.log('🎉 เทสพื้นฐานผ่านฉลุย!');
    
  } catch (error) {
    console.error('💥 บึ้ม! มีอะไรผิดพลาด:', error);
  }
}

test();
