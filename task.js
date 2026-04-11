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
  const deliveryUrl = process.env.DELIVERY_URL; 
  const gasUrl = process.env.GAS_WEBAPP_URL;

  try {
    console.log(`\n=========================================`);
    console.log(`🚀 RPA開始 (対象行: ${rowIdx})`);
    console.log(`=========================================`);

    // [Step 1] ターゲットURLへアクセス
    console.log(`\n[Step 1] ターゲットURLにアクセスします: ${targetUrl}`);
    await page.goto(targetUrl);
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible()) {
      console.log(`  => 🔑 ID/PASS入力画面を検知。情報を入力します。`);
      await emailInput.fill(process.env.SQUADBEYOND_ID);
      await page.waitForTimeout(1000);
      await page.locator('input[name="password"]').fill(process.env.SQUADBEYOND_PASS);
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'ログイン' }).first().click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(3000);
    }

    const secondLoginButton = page.getByRole('button', { name: 'ログイン', exact: true });
    if (await secondLoginButton.isVisible()) {
      await secondLoginButton.first().click();
      await page.waitForTimeout(5000); 
      await page.waitForLoadState('load');
    }

    // [Step 2] フォルダ作成
    console.log(`\n[Step 2] 検索窓に「木村」と入力して絞り込みます。`);
    await page.locator('input[type="search"]').first().fill('木村');
    await page.waitForTimeout(2000);

    console.log(`\n[Step 3] グループ名「${groupName}」のメニューを開きます。`);
    const groupRow = page.locator('div, li').filter({ hasText: groupName }).filter({ has: page.locator('button') }).last();
    await groupRow.locator('button').last().click();
    await page.waitForTimeout(2000);

    console.log(`\n[Step 4] ポップアップメニューから「フォルダ作成」をクリックします。`);
    await page.locator('.MuiPopover-root, [role="menu"]').getByText('フォルダ作成', { exact: true }).click();
    await page.waitForTimeout(3000);

    console.log(`\n[Step 5] フォルダ作成情報を入力中...`);
    const folderNameInput = page.locator('label:has-text("フォルダ名")').locator('xpath=..').locator('input');
    await folderNameInput.fill(accountName);
    await page.waitForTimeout(1000);
    
    const domainLabelBox = page.locator('label:has-text("認証済み独自ドメイン")').locator('xpath=..');
    await domainLabelBox.click();
    await page.waitForTimeout(1000);
    await page.getByRole('option', { name: domain }).click();
    
    await page.getByRole('button', { name: '作成する' }).click();
    console.log(`  => ⏳ フォルダ作成中...`);
    await page.waitForTimeout(5000);

    // [Step 7-9] 記事の検索
    console.log(`\n[Step 7-9] 記事「${targetArticle}」を検索します。`);
    await page.locator('input[type="search"]').first().fill(searchKeyword);
    await page.waitForTimeout(2000);
    await page.getByText('原本グループ').click();
    await page.waitForTimeout(2000);
    await page.locator('div, li').filter({ hasText: searchKeyword }).filter({ has: page.locator('button') }).last().click();
    await page.waitForTimeout(2000);
    
    const articleSearchInput = page.locator('label').filter({ hasText: '媒体/名前検索' }).locator('xpath=..').locator('input').first();
    await articleSearchInput.fill(targetArticle);
    await page.waitForTimeout(2000);
    
    // [Step 10] 複製メニュー
    console.log(`\n[Step 10] 「別フォルダへ複製」を選択します。`);
    const articleRow = page.locator('div, li').filter({ hasText: targetArticle }).filter({ has: page.locator('button') }).last();
    await articleRow.locator('button').nth(-2).click(); 
    await page.waitForTimeout(1000);
    await page.locator('.MuiPopover-root, [role="menu"]').getByText('別フォルダへ複製', { exact: true }).click();
    await page.waitForTimeout(3000);

    // ★ Step 11: 複製設定（超重要：確実に選択するロジック）
    console.log(`\n[Step 11] 複製設定を入力します。`);
    
    // チーム選択
    const teamBox = page.locator('label').filter({ hasText: /^チーム$/ }).locator('xpath=..');
    await teamBox.click();
    await page.waitForTimeout(1000);
    await page.getByRole('option', { name: 'フルアウト' }).click();
    await page.waitForTimeout(1000);

    // フォルダグループ選択
    console.log(`  - フォルダグループ「${groupName}」を選択します。`);
    const groupFolderBox = page.locator('label').filter({ hasText: /^フォルダグループ$/ }).locator('xpath=..');
    await groupFolderBox.locator('input').fill(groupName);
    await page.waitForTimeout(2000);
    await page.getByRole('option', { name: groupName }).first().click();
    await page.waitForTimeout(1000);
    
    // 移動先フォルダ選択
    console.log(`  - 移動先フォルダ「${accountName}」を確実に入力・選択します。`);
    const folderBox = page.locator('label').filter({ hasText: /^フォルダ$/ }).locator('xpath=..');
    const folderInput = folderBox.locator('input');
    await folderInput.fill(accountName);
    await page.waitForTimeout(3000); // 候補が出るのを待つ

    // 候補の中から「完全に一致する名前」を探してクリック
    const option = page.getByRole('option').filter({ hasText: accountName }).first();
    if (await option.isVisible()) {
        await option.click();
        console.log(`    => リストからフォルダを特定して選択しました。`);
    } else {
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        console.log(`    => 警告：リストが見えなかったためキー操作で確定しました。`);
    }
    await page.waitForTimeout(1000);

    // 配信URL
    if (deliveryUrl) {
      await page.getByPlaceholder('半角英数字,-,_が使えます').fill(deliveryUrl);
    }
    
    // ★複製ボタンのクリック（有効化されるまで少し待つ）
    const copySubmitBtn = page.getByRole('button', { name: '複製する' });
    await copySubmitBtn.waitFor({ state: 'visible' });
    await page.waitForTimeout(1000);
    await copySubmitBtn.click();
    
    console.log(`\n[Step 12.5] 確認ポップアップを承認します。`);
    const confirmBtn = page.getByText('確認して複製を実行');
    await confirmBtn.waitFor({ state: 'visible' });
    await page.waitForTimeout(1000);
    await confirmBtn.click();
    
    // 画面からモーダルが消えるのを待ち、さらに複製完了を確実にするため待機
    console.log(`  => ⏳ 複製処理の完了を待機しています...`);
    await page.waitForTimeout(10000); // 念入りに10秒待機

    // 最終的な画面の状態を撮影（デバッグ用）
    await page.screenshot({ path: 'final-check.png', fullPage: true });
    console.log(`📸 最終確認画面のスクリーンショットを保存しました。`);

    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: "", status: 'success' });
    }
    console.log(`\n🎉 RPA処理が完了しました！`);

  } catch (error) {
    console.error(`\n❌ エラー発生:\n`, error);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: "", status: 'error' });
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
