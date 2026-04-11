const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch();
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
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    const loginLink = page.getByRole('link', { name: 'ログインページへ' });
    if (await loginLink.isVisible()) {
      console.log(`  => ⚠️ セッション切れを検知。「ログインページへ」進みます。`);
      await loginLink.click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(2000);
    }

    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible()) {
      console.log(`  => 🔑 ID/PASS入力画面を検知。情報を入力します。`);
      await emailInput.fill(process.env.SQUADBEYOND_ID);
      await page.waitForTimeout(500);
      await page.locator('input[name="password"]').fill(process.env.SQUADBEYOND_PASS);
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'ログイン' }).first().click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(2000);
    }

    const secondLoginButton = page.getByRole('button', { name: 'ログイン', exact: true });
    if (await secondLoginButton.isVisible()) {
      console.log(`  => 🔄 アカウント選択画面を検知。追加の「ログイン」ボタンを押します。`);
      await secondLoginButton.first().click();
      console.log(`  => ⏳ 画面遷移のため5秒待機します...`);
      await page.waitForTimeout(5000); 
      await page.waitForLoadState('load');
    }

    console.log(`  => ✅ ログインフロー突破。ターゲットURLを再度開きます。`);
    await page.goto(targetUrl);
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    // [Step 2] フォルダ作成のための検索とメニュー操作
    console.log(`\n[Step 2] 検索窓に「木村」と入力して絞り込みます。`);
    await page.locator('input[type="search"]').first().fill('木村');
    await page.waitForTimeout(2000);

    console.log(`\n[Step 3] グループ名「${groupName}」のメニューを開きます。`);
    const groupRow = page.locator('div, li').filter({ hasText: groupName }).filter({ has: page.locator('button') }).last();
    await groupRow.locator('button').last().click();
    await page.waitForTimeout(2000);

    console.log(`\n[Step 4] ポップアップメニューから「フォルダ作成」をクリックします。`);
    const createFolderBtn = page.locator('.MuiPopover-root, [role="menu"]').getByText('フォルダ作成', { exact: true });
    await createFolderBtn.waitFor({ state: 'visible', timeout: 5000 });
    await createFolderBtn.hover();
    await page.waitForTimeout(500);
    await createFolderBtn.click();
    
    console.log(`  => ⏳ モーダルが開くのを待機します...`);
    await page.waitForTimeout(3000);

    // [Step 5] フォルダ作成情報の入力
    console.log(`\n[Step 5] フォルダ作成情報を入力中...`);
    
    console.log(`  - フォルダ名を入力: ${accountName}`);
    const folderNameInput = page.locator('label:has-text("フォルダ名")').locator('xpath=..').locator('input');
    await folderNameInput.waitFor({ state: 'visible', timeout: 5000 }); 
    await folderNameInput.fill(accountName);
    await page.waitForTimeout(1000);
    
    console.log(`  - ドメインを選択: ${domain}`);
    const domainLabelBox = page.locator('label:has-text("認証済み独自ドメイン")').locator('xpath=..');
    await domainLabelBox.click();
    await page.waitForTimeout(1000);
    await page.getByRole('option', { name: domain }).click();
    await page.waitForTimeout(1000);
    
    console.log(`\n[Step 6] 「作成する」ボタンを押してフォルダを確定します。`);
    await page.getByRole('button', { name: '作成する' }).click();
    
    console.log(`  => ⏳ フォルダ作成後の画面反映を待機します...`);
    await page.waitForLoadState('load');
    await page.waitForTimeout(5000);

    // [Step 7] 記事の検索
    console.log(`\n[Step 7] 検索窓にキーワード「${searchKeyword}」を入力します。`);
    await page.locator('input[type="search"]').first().fill('');
    await page.waitForTimeout(500);
    await page.locator('input[type="search"]').first().fill(searchKeyword);
    await page.waitForTimeout(2000);

    console.log(`\n[Step 8] 「原本グループ」をクリックします。`);
    await page.getByText('原本グループ').click();
    await page.waitForTimeout(2000);

    // ★追加: 対象のフォルダを開いて中身（記事）を表示させる
    console.log(`\n[Step 8.5] フォルダ「${searchKeyword}」をクリックして開きます。`);
    const targetFolderRow = page.locator('div, li').filter({ hasText: searchKeyword }).filter({ has: page.locator('button') }).last();
    await targetFolderRow.click(); // コロンではなく行をクリックして中身を開く
    await page.waitForTimeout(3000); // 記事リストが表示されるのを待機

    console.log(`\n[Step 9] 記事名「${targetArticle}」を検索します。`);
    // ★修正: プレースホルダーではなく、ラベルテキストから確実にinputを探し出す
    const articleSearchInput = page.locator('label').filter({ hasText: '媒体/名前検索' }).locator('xpath=..').locator('input').first();
    
    if (await articleSearchInput.isVisible()) {
      await articleSearchInput.fill(targetArticle);
    } else {
      // 見つからなかった場合の最終手段（右上の検索窓を直撃）
      await page.getByRole('textbox').last().fill(targetArticle);
    }
    await page.waitForTimeout(2000);
    
    // [Step 10] 記事の複製操作
    console.log(`\n[Step 10] 該当記事のメニューを開き、「別フォルダへ複製」を選択します。`);
    const articleRow = page.locator('div, li').filter({ hasText: targetArticle }).filter({ has: page.locator('button') }).last();
    await articleRow.locator('button').last().click();
    await page.waitForTimeout(2000);
    
    const duplicateBtn = page.locator('.MuiPopover-root, [role="menu"]').getByText('別フォルダへ複製', { exact: true });
    await duplicateBtn.waitFor({ state: 'visible', timeout: 5000 });
    await duplicateBtn.hover();
    await page.waitForTimeout(500);
    await duplicateBtn.click();
    await page.waitForTimeout(3000);

    console.log(`\n[Step 11] 複製設定を入力中...`);
    await page.locator('input[type="text"].MuiFilledInput-input').first().fill(targetArticle);
    await page.waitForTimeout(1000);
    
    await page.getByRole('button', { name: /​/ }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('option', { name: 'フルアウト' }).click();
    await page.waitForTimeout(1000);
    
    console.log(`  - 移動先フォルダを「${accountName}」に設定します。`);
    await page.locator('input[role="combobox"]').last().fill(accountName);
    await page.waitForTimeout(1000);
    await page.getByRole('option', { name: accountName }).click();
    await page.waitForTimeout(1000);
    
    console.log(`\n[Step 12] 「複製する」をクリックして確定します。`);
    await page.getByRole('button', { name: '複製する' }).click();
    
    console.log(`  => ⏳ 記事複製後の処理を待機します...`);
    await page.waitForLoadState('load');
    await page.waitForTimeout(5000);

    // [Step 13] 最終URL取得処理
    console.log(`\n[Step 13] 作成したフォルダ「${accountName}」を再検索して移動します。`);
    await page.locator('input[type="search"]').first().fill('');
    await page.waitForTimeout(500);
    await page.locator('input[type="search"]').first().fill(accountName);
    await page.waitForTimeout(2000);
    
    // 作成したフォルダをクリックして開く
    const finalFolderRow = page.locator('div, li').filter({ hasText: accountName }).filter({ has: page.locator('button') }).last();
    await finalFolderRow.click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    console.log(`\n[Step 14] 複製された記事のメニューから、入稿用URLを取得します。`);
    const resultArticleRow = page.locator('div, li').filter({ hasText: targetArticle }).filter({ has: page.locator('button') }).last();
    await resultArticleRow.locator('button').last().click();
    await page.waitForTimeout(2000);

    entryUrl = await page.evaluate(() => {
        const input = document.querySelector('input[readonly]');
        return input ? input.value : location.href;
    });
    console.log(`  => 🎯 取得成功URL: ${entryUrl}`);

    // [Step 15] GASへの書き戻し
    console.log(`\n[Step 15] 取得したURLをGASへ送信（報告）します。`);
    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: entryUrl, status: 'success' });
    }

    console.log(`\n🎉 RPA処理が正常に完了しました！`);

  } catch (error) {
    console.error(`\n❌ [Error] エラーが発生しました:\n`, error);
    
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
