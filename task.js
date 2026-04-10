const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch();
  // 動画保存をオフにして、シンプルに起動します
  const context = await browser.newContext({
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
    console.log(`\n=========================================`);
    console.log(`🚀 RPA開始 (対象行: ${rowIdx})`);
    console.log(`=========================================`);

    // [Step 1] ターゲットURLへアクセス
    console.log(`\n[Step 1] ターゲットURLにアクセスします: ${targetUrl}`);
    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle');

    // パターンA: 「ログインページへ」というポップアップが出た場合
    const loginLink = page.getByRole('link', { name: 'ログインページへ' });
    if (await loginLink.isVisible()) {
      console.log(`  => ⚠️ セッション切れを検知。「ログインページへ」進みます。`);
      await loginLink.click();
      await page.waitForLoadState('networkidle');
    }

    // パターンB: ログイン画面（メール入力欄）が表示されているか確認
    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible()) {
      console.log(`  => 🔑 ログイン画面を検知。ログイン情報を入力します。`);
      await emailInput.fill(process.env.SQUADBEYOND_ID);
      await page.locator('input[name="password"]').fill(process.env.SQUADBEYOND_PASS);
      await page.getByRole('button', { name: 'ログイン' }).click();
      await page.waitForNavigation();
      
      console.log(`  => ✅ ログイン成功。再度ターゲットURLへ移動します。`);
      await page.goto(targetUrl);
      await page.waitForLoadState('networkidle');
    } else {
      console.log(`  => ✅ ログイン済み、または対象ページに直接アクセスできました。`);
    }

    // [Step 2] フォルダ作成のための検索とメニュー操作
    console.log(`\n[Step 2] 検索窓に「木村」と入力して絞り込みます。`);
    await page.locator('input[type="search"]').first().fill('木村');
    await page.waitForTimeout(1000);

    console.log(`\n[Step 3] グループ名「${groupName}」のメニューを開きます。`);
    const menuButton = page.locator(`div:has-text("${groupName}")`).locator('button').last();
    await menuButton.click();

    console.log(`\n[Step 4] メニューから「フォルダ作成」をクリックします。`);
    await page.getByRole('button', { name: 'フォルダ作成' }).click();

    // [Step 3] フォルダ作成情報の入力
    console.log(`\n[Step 5] フォルダ作成情報を入力中...`);
    await page.locator('input[type="text"][required]').fill(accountName);
    await page.getByLabel('認証済み独自ドメイン').click();
    await page.getByRole('option', { name: domain }).click();
    
    console.log(`\n[Step 6] 「作成する」ボタンを押してフォルダを確定します。`);
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForLoadState('networkidle');

    // [Step 4] 記事の検索
    console.log(`\n[Step 7] 検索窓にキーワード「${searchKeyword}」を入力します。`);
    await page.locator('input[type="search"]').first().fill(searchKeyword);
    await page.waitForTimeout(1000);

    console.log(`\n[Step 8] 「原本グループ」をクリックします。`);
    await page.getByText('原本グループ').click();

    console.log(`\n[Step 9] 記事名「${targetArticle}」を検索します。`);
    await page.getByPlaceholder('媒体/名前検索').fill(targetArticle);
    await page.waitForTimeout(1000);
    
    // [Step 5] 記事の複製操作
    console.log(`\n[Step 10] 該当記事のメニューを開き、「別フォルダへ複製」を選択します。`);
    const articleMenu = page.locator(`div:has-text("${targetArticle}")`).locator('button').last();
    await articleMenu.click();
    await page.getByText('別フォルダへ複製').click();

    console.log(`\n[Step 11] 複製設定を入力中...`);
    await page.locator('input[type="text"].MuiFilledInput-input').first().fill(targetArticle);
    await page.getByRole('button', { name: /​/ }).click();
    await page.getByRole('option', { name: 'フルアウト' }).click();
    
    await page.locator('input[role="combobox"]').fill(accountName);
    await page.getByRole('option', { name: accountName }).click();
    
    console.log(`\n[Step 12] 「複製する」をクリックして確定します。`);
    await page.getByRole('button', { name: '複製する' }).click();
    await page.waitForLoadState('networkidle');

    // [Step 6] 最終URL取得処理
    console.log(`\n[Step 13] 作成したフォルダ「${accountName}」を再検索して移動します。`);
    await page.locator('input[type="search"]').first().fill(accountName);
    await page.getByText(accountName, { exact: true }).click();
    await page.waitForLoadState('networkidle');

    console.log(`\n[Step 14] 複製された記事のメニューから、入稿用URLを取得します。`);
    const resultMenu = page.locator(`div:has-text("${targetArticle}")`).locator('button').last();
    await resultMenu.click();

    entryUrl = await page.evaluate(() => {
        const input = document.querySelector('input[readonly]');
        return input ? input.value : location.href;
    });
    console.log(`  => 🎯 取得成功URL: ${entryUrl}`);

    // [Step 7] GASへの書き戻し
    console.log(`\n[Step 15] 取得したURLをGASへ送信（報告）します。`);
    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: entryUrl, status: 'success' });
    }

    console.log(`\n🎉 RPA処理が正常に完了しました！`);

  } catch (error) {
    console.error(`\n❌ [Error] エラーが発生しました:\n`, error);
    
    // エラーが起きた瞬間の画面をスクショ撮影（これでもう迷わない！）
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
    console.log(`📸 エラー画面のスクリーンショットを保存しました。`);

    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: "", status: 'error' }).catch(e => console.error("GAS報告失敗:", e));
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
