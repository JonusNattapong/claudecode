import { chromium } from 'playwright'

async function testBrowser() {
  console.log('🚀 เริ่มการทดสอบ BrowserTool (Playwright)...')
  
  const browser = await chromium.launch({ headless: false }) // เปิดให้เห็นตัวเป็นๆ เลย
  const page = await browser.newPage()
  
  try {
    console.log('🌐 กำลังเปิด Google...')
    await page.goto('https://www.google.com')
    
    console.log('⌨️ กำลังพิมพ์ค้นหา "Claude Code"...')
    await page.fill('textarea[name="q"]', 'Claude Code')
    await page.keyboard.press('Enter')
    
    console.log('⏳ รอผลลัพธ์แป๊บ...')
    await page.waitForNavigation()
    
    const title = await page.title()
    console.log(`✅ ค้นหาเสร็จสิ้น! หัวข้อหน้าเว็บคือ: ${title}`)
    
    // ถ่ายรูปเก็บไว้เป็นที่ระลึก
    await page.screenshot({ path: 'scratch/test_screenshot.png' })
    console.log('📸 บันทึกรูปภาพไว้ที่ scratch/test_screenshot.png แล้ว')
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error)
  } finally {
    console.log('🔒 กำลังปิด Browser ในอีก 3 วินาที...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    await browser.close()
    console.log('🏁 จบการทดสอบ!')
  }
}

testBrowser()
