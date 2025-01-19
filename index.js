const moment = require("moment");
const puppeteer = require("puppeteer");
const Tesseract = require("tesseract.js");
const {setIntervalAsync} = require("set-interval-async/fixed");
const schedule = require('./subjects.json');
let prevTime = '';

async function portalScrap() {
  async function main() {
    let currentTime = moment().format("LT");
    let today = moment().format("dddd").toLowerCase();
    if (prevTime !== currentTime) {
      prevTime = currentTime;
      for (let [scheduleDay, entries] of Object.entries(schedule)) {
        if (scheduleDay === today) {
          const foundSchedule = entries.find(entry => entry.time === currentTime)
          if (foundSchedule) {
            console.log('GETTING')
            await proceed(foundSchedule.type, currentTime);
            console.table([foundSchedule])
          }
        } else {
          console.log('----------');
        }
      }
    }
  }

  async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function proceed(sendingType, currentTime) {
    console.log(`[Current Time]: ${currentTime} Let's start processing...`);
    console.log(`[Current Doing]: ${sendingType}`);
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: ['--start-maximized']
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    try {

      console.log("Phase 1: Logging in...");
      await page.goto("https://www.aclcbukidnon.com/Employees", {
        waitUntil: "networkidle2"
      });

      // Attempt to log in
      await page.type("[id=ContentPlaceHolder1_txtEmployyeID]", "username");
      await page.type("[id=ContentPlaceHolder1_txtPassword]", "5h*MpJU3Kz7Aayhs");
      await page.click("[id=ContentPlaceHolder1_BtnLogin]");
      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: 10000
      });

      // Phase 2: Clock In/Out with CAPTCHA
      console.log("Phase 2: Handling Clock In/Out...");
      await page.goto("https://www.aclcbukidnon.com/Employees/CLOCKIN_CLOCKOUT", {
        waitUntil: "networkidle2"
      });

      // Take screenshot before CAPTCHA handling
      await page.screenshot({path: "before_captcha.png"});

      const maxRetries = 20;
      let attempt = 0;
      let success = false;

      while (attempt < maxRetries && !success) {
        attempt++;
        console.log(`CAPTCHA attempt ${attempt} of ${maxRetries}`);

        const captchaSelector = '#ContentPlaceHolder1_Image2';
        await page.waitForSelector(captchaSelector, {visible: true, timeout: 5000});
        const captchaImage = await page.$(captchaSelector);
        const screenshot = await captchaImage.screenshot({
          encoding: 'binary'
        });

        // 4. Use Tesseract to do OCR on the captcha
        const {data: {text}} = await Tesseract.recognize(
          screenshot,
          "eng",
          {
            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
            psm: 7
          }
        );

        let captchaText = text.replace(/[^0-9a-zA-Z]/g, "").trim();

        // Ensure we only get 2 characters
        captchaText = captchaText.substring(0, 2);

        console.log('Detected CAPTCHA:', captchaText);

        if (captchaText) {
          // 5. Type the recognized text into the verification code input
          // Adjust the selector if needed
          await page.type("#ContentPlaceHolder1_txtVerificationCode", captchaText);
          await page.click("[id=ContentPlaceHolder1_btnClock]");
          await page.screenshot({path: "CLOCKIN_CLOCKOUT.png"});
          await delay(2000);
        }
      }

    } catch (error) {
      await page.screenshot({path: "error_state.png"});
      console.log(error.message);
      process.exit();
    } finally {
      // await browser.close();
      await page.screenshot({path: "after_clock.png"});
    }
  }

  await main();
}

setIntervalAsync(async () => {
  await portalScrap();
}, 1000);
