const moment = require("moment");
const puppeteer = require("puppeteer");
const { createWorker } = require("tesseract.js");
const { setIntervalAsync } = require("set-interval-async/fixed");
const schedule = require('./subjects.json');
let prevTime = '';
let browser = '';

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
            await proceed(foundSchedule.type, currentTime);
            console.table([foundSchedule])
          }
        }
      }
    }
  }

  async function proceed(sendingType, currentTime) {
    console.log(`[Current Time]: ${currentTime} Let's start processing...`);
    console.log(`[Current Doing]: ${sendingType}`);

    if (!browser) {
      browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: null,
        args: ['--start-maximized']
      });
    }

    const page = await browser.newPage();

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
        waitUntil: "networkidle2"
      });

      // Phase 2: Clock In/Out with CAPTCHA
      console.log("Phase 2: Handling Clock In/Out...");
      await page.goto("https://www.aclcbukidnon.com/Employees/CLOCKIN_CLOCKOUT", {
        waitUntil: "networkidle2"
      });

      const signalTries = 5;
      let signalAttempt = 0;
      let signalSuccess = false;
      while (signalAttempt <= signalTries && !signalSuccess) {
        const maxRetries = 200;
        let attempt = 0;
        let success = false;

        while (attempt < maxRetries && !success) {
          attempt++;
          const captchaSelector = '#ContentPlaceHolder1_Image2';
          try {
            const element = await page.waitForSelector(captchaSelector, { visible: true, timeout: 10000 });
            const captchaImage = await page.$(captchaSelector);
            const screenshot = await captchaImage.screenshot({
              encoding: 'binary'
            });  
            const worker = await createWorker('eng');
            const { data: { text } } = await worker.recognize(
              screenshot,
              "eng",
              {
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
                psm: 7
              }
            );
            
            let captchaText = text.replace(/[^0-9a-zA-Z]/g, "").trim();
            captchaText = captchaText.substring(0, 2);
            console.log('Detected CAPTCHA:', captchaText);

            await element.dispose();
            await worker.terminate();

            if(!captchaText) {
              console.log("CAPTCHA extraction failed. Retrying...");
              await page.reload();
            }

            if (captchaText.length !== 0) {
              // await page.type("[id=ContentPlaceHolder1_txtEmployyeID]", "username");
              await page.type("[id=ContentPlaceHolder1_txtVerificationCode]", captchaText);
              await page.click("[id=ContentPlaceHolder1_btnClock]");
              await page.screenshot({ path: "CLOCKIN_CLOCKOUT.png" });
              await new Promise(resolve => setTimeout(resolve, 2000));

              // Check if we got an error message
              const errorMessage = await page.$eval(
                "#ContentPlaceHolder1_lblCaptchaMessage",
                el => el.innerText
              ).catch(() => '');

              if (errorMessage === 'You have entered correct captch code') {
                success = true;
                signalSuccess = true;
                console.log("CAPTCHA verification successful");
                break;
              }
            }
          } catch (error) {
            console.log("CAPTCHA processing error:", error.message);
          }
        }

        if (!success) {
          console.log("Retrying CAPTCHA...");
          await new Promise(resolve => setTimeout(resolve, 10000));
          await page.reload();
        }
      }
      if (!signalSuccess) {
        console.log("Failed to verify CAPTCHA after multiple attempts.");
      }
    } catch (error) {
      console.log("Error during processing:", error.message);
    } finally {
      await page.close();
    }
  }

  await main();
}


// Cleanup function to ensure browser is closed when script exits
async function cleanup() {
  if (browser) {
    await browser.close();
    browser = null;
  }
  process.exit();
}

// Handle script termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

setIntervalAsync(async () => {
  await portalScrap();
}, 1000);
