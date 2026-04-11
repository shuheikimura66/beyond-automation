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
  const groupName = process.env.GROUP_NAME; // ※スプシのC列の値がここに入ります
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

    const loginLink = page.getByRole('link', { name: 'ログインページへ' });
    if (await loginLink.isVisible()) {
      console.log(`  => ⚠️ セッション切れを検知。「ログインページへ」進みます。`);
      await loginLink.click();
      await page.waitForLoadState('load');
    }

    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible()) {
      console.log(`  => 🔑 ID/PASS入力画面を検知。情報を入力します。`);
      await emailInput.fill(process.env.SQUADBEYOND_ID);
      await page.locator('input[name="password"]').fill(process.env.SQUADBEYOND_PASS);
      await page.getByRole('button', { name: 'ログイン' }).first().click();
      await page.waitForLoadState('load');
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

    // [Step 2] フォルダ作成のための検索とメニュー操作
    console.log(`\n[Step 2] 検索窓に「木村」と入力して絞り込みます。`);
    await page.locator('input[type="search"]').first().fill('木村');
    await page.waitForTimeout(1500); // 検索結果の絞り込みをしっかり待つ

    // [Step 3] グループ名（スプシC列）の特定とメニューの展開
    console.log(`\n[Step 3] グループ名「${groupName}」のメニューを開きます。`);
    // グループ名を含む行を特定し、その横にあるコロン（ボタン）を押す
    const groupRow = page.locator(`div:has-text("${groupName}")`).last();
    await groupRow.locator('button').last().click();
    await page.waitForTimeout(1000); // ポップアップメニューが展開するのを待つ

    // [Step 4] ポップアップメニュー内の「フォルダ作成」をクリック
    console.log(`\n[Step 4] メニューから「フォルダ作成」をクリックします。`);
    // ★修正ポイント: リストアイテム（li要素）またはメニューアイテム（role="menuitem"）の中のテキストに限定
    await page.locator('li, [role="menuitem"]').filter({ hasText: 'フォルダ作成' }).click();
    await page.waitForTimeout(1500); // フォルダ作成モーダル画面が開くのをしっかり待機

    // [Step 5] フォルダ作成情報の入力（モーダル内）
    console.log(`\n[Step 5] フォルダ作成情報を入力中...`);
    
    console.log(`  - フォルダ名を入力: ${accountName}`);
    const folderNameInput = page.locator('label:has-text("フォルダ名")').locator('xpath=..').locator('input');
    await folderNameInput.fill(accountName);
    await page.keyboard.press('Escape'); // サジェストが他のボタンを隠すのを防ぐ
    
    console.log(`  - ドメインを選択: ${domain}`);
    await page.getByLabel('認証済み独自ドメイン').click();
    // ドメインのリストから選択
    await page.getByRole('option', { name: domain }).click();
    
    console.log(`\n[Step 6] 「作成する」ボタンを押してフォルダを確定します。`);
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000); // フォルダが作成され、画面がリフレッシュされるのを待つ

    // [Step 7] 記事の検索
    console.log(`\n[Step 7] 検索窓にキーワード「${searchKeyword}」を入力します。`);
    await page.locator('input[type="search"]').first().fill(searchKeyword);
    await page.waitForTimeout(1500);

    console.log(`\n[Step 8] 「原本グループ」をクリックします。`);
    await page.getByText('原本グループ').click();

    console.log(`\n[Step 9] 記事名「${targetArticle}」を検索します。`);
    await page.getByPlaceholder('媒体/名前検索').fill(targetArticle);
    await page.waitForTimeout(1500);
    
    // [Step 10] 記事の複製操作
    console.log(`\n[Step 10] 該当記事のメニューを開き、「別フォルダへ複製」を選択します。`);
    const articleMenu = page.locator(`div:has-text("${targetArticle}")`).locator('button').last();
    await articleMenu.click();
    await page.waitForTimeout(1000);
    await page.locator('li, [role="menuitem"]').filter({ hasText: '別フォルダへ複製' }).click();
    await page.waitForTimeout(1500); // 複製設定モーダルが開くのを待つ

    console.log(`\n[Step 11] 複製設定を入力中...`);
    await page.locator('input[type="text"].MuiFilledInput-input').first().fill(targetArticle);
    
    // チーム選択
    await page.getByRole('button', { name: /​/ }).click();
    await page.getByRole('option', { name: 'フルアウト' }).click();
    
    // 複製先のフォルダ名を入力（先ほど作ったフォルダ名）
    console.log(`  - 移動先フォルダを「${accountName}」に設定します。`);
    await page.locator('input[role="combobox"]').last().fill(accountName);
    await page.getByRole('option', { name: accountName }).click();
    
    console.log(`\n[Step 12] 「複製する」をクリックして確定します。`);
    await page.getByRole('button', { name: '複製する' }).click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // [Step 13] 最終URL取得処理
    console.log(`\n[Step 13] 作成したフォルダ「${accountName}」を再検索して移動します。`);
    await page.locator('input[type="search"]').first().fill(accountName);
    await page.getByText(accountName, { exact: true }).click();
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);

    console.log(`\n[Step 14] 複製された記事のメニューから、入稿用URLを取得します。`);
    const resultMenu = page.locator(`div:has-text("${targetArticle}")`).locator('button').last();
    await resultMenu.click();
    await page.waitForTimeout(1000);

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
