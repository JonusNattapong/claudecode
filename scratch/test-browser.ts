
import { handleBrowserAction } from '../src/tools/BrowserTool/handler';

async function test() {
  console.log('🚀 เริ่มต้นการทดสอบ Browser Use...');
  
  try {
    // 1. ลอง Navigate ไปที่ Google
    console.log('🌐 กำลังเดินทางไป Google...');
    const navResult = await handleBrowserAction({
      action: 'navigate',
      url: 'https://www.google.com',
      headless: true // รันแบบไม่มีหน้าต่างโชว์เพื่อความเร็วในการเทสผ่าน terminal
    });
    console.log('✅ เข้าถึงหน้าเว็บสำเร็จ:', navResult.title);

    // 2. ลองพิมพ์ค้นหาคำว่า "Claude Code"
    console.log('⌨️ กำลังพิมพ์ค้นหา "Claude Code"...');
    await handleBrowserAction({
      action: 'type',
      selector: 'textarea[name="q"]',
      text: 'Claude Code'
    });

    // 3. กด Enter
    console.log('⏎ กด Enter...');
    const searchResult = await handleBrowserAction({
      action: 'press',
      key: 'Enter'
    });

    // 4. รอสักแป๊บแล้วแคปหน้าจอ
    console.log('📸 กำลังเก็บภาพหลักฐาน...');
    const finalResult = await handleBrowserAction({
      action: 'screenshot'
    });

    if (finalResult.screenshot) {
      console.log('🎉 เทสเสร็จสมบูรณ์! ได้ภาพ Screenshot มาแล้ว (Base64 ยาวเหยียด)');
      // เพื่อนจะไม่ print base64 ออกมานะเดี๋ยวจอมันจะค้าง 555
    } else {
      console.log('❌ เอ่อ... หน้าจอว่างเปล่าแฮะ');
    }

    // 5. ปิด Browser
    console.log('🚪 ปิดการเชื่อมต่อ...');
    await handleBrowserAction({ action: 'close' });
    
  } catch (error) {
    console.error('💥 บึ้ม! มีอะไรผิดพลาด:', error);
  }
}

test();
