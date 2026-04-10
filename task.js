const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: { dir: 'videos/' },
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  const rowIdx = process.env.ROW_IDX;
  const domain = process.env.DOMAIN;
  const groupName = process.env.GROUP_NAME;
  const targetUrl = process.env.TARGET_URL;
  const accountName = process.env.ACCOUNT_NAME;
  const articleName = process.env.ARTICLE_NAME;
  const searchKeyword = process.env.SEARCH_KEYWORD;
  const targetArticle = process.env.TARGET_ARTICLE;
  const gasUrl = process.env.GAS_WEBAPP_URL;

  let entryUrl = "";

  try {
    console.log(`--- RPA開始 (行: ${rowIdx}) ---`);

    await page.goto('https://app.squadbeyond.com/login'); 
    await page.fill('input[name="email"]', process.env.SQUADBEYOND_ID);
    await page.fill('input[name="password"]', process.env.SQUADBEYOND_PASS);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForNavigation();

    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle');

    // 操作
    await page.locator('input[type="search"]').first().fill('木村');
    const menuButton = page.locator(`div:has-text("${groupName}")`).locator('button').last();
    await menuButton.click();
    await page.getByRole('button', { name: 'フォルダ作成' }).click();

    await page.locator('input[type="text"][required]').fill(accountName);
    await page.getByLabel('認証済み独自ドメイン').click();
    await page.getByRole('option', { name: domain }).click();
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="search"]').first().fill(searchKeyword);
    await page.waitForTimeout(1000);
    await page.getByText('原本グループ').click();
    await page.getByPlaceholder('媒体/名前検索').fill(targetArticle);
    await page.waitForTimeout(1000);
    
    const articleMenu = page.locator(`div:has-text("${targetArticle}")`).locator('button').last();
    await articleMenu.click();
    await page.getByText('別フォルダへ複製').click();

    await page.locator('input[type="text"].MuiFilledInput-input').first().fill(targetArticle);
    await page.getByRole('button', { name: /​/ }).click(); 
    await page.getByRole('option', { name: 'フルアウト' }).click();
    
    await page.locator('input[role="combobox"]').fill(accountName);
    await page.getByRole('option', { name: accountName }).click();
    await page.getByRole('button', { name: '複製する' }).click();
    await page.waitForLoadState('networkidle');

    // 最終URL取得
    await page.locator('input[type="search"]').first().fill(accountName);
    await page.getByText(accountName, { exact: true }).click();
    await page.waitForLoadState('networkidle');

    const resultMenu = page.locator(`div:has-text("${targetArticle}")`).locator('button').last();
    await resultMenu.click();

    entryUrl = await page.evaluate(() => {
        const input = document.querySelector('input[readonly]');
        return input ? input.value : location.href;
    });

    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: entryUrl, status: 'success' });
    }

  } catch (error) {
    console.error("Error:", error);
    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: "", status: 'error' });
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
