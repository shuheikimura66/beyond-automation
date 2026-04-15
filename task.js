const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();

  const rowIdx = process.env.ROW_IDX;
  const domain = process.env.DOMAIN;
  const groupName = process.env.GROUP_NAME;
  const accountName = process.env.ACCOUNT_NAME;
  const searchKeyword = process.env.SEARCH_KEYWORD;
  const targetArticle = process.env.TARGET_ARTICLE;
  const deliveryUrl = process.env.DELIVERY_URL; 
  const gasUrl = process.env.GAS_WEBAPP_URL;

  const targetUrl = 'https://app.squadbeyond.com/';

  try {
    console.log(`\n=========================================`);
    console.log(`🚀 RPA開始 (対象行: ${rowIdx})`);
    console.log(`=========================================`);

    // [Step 0 & 1] ログイン処理
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

    // [Step 2] 全体検索（木村）
    console.log(`\n[Step 2] 検索窓に「木村」と入力して絞り込みます。`);
    // ★修正：見えている検索窓を確実に指定し、クリックしてから入力
    const searchInput = page.locator('input[type="search"]').filter({ state: 'visible' }).first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.click();
    await searchInput.fill('');
    await searchInput.pressSequentially('木村', { delay: 50 });
    await page.waitForTimeout(3000);

    // [Step 3] グループ展開
    console.log(`\n[Step 3] グループ名「${groupName}」のメニューを開きます。`);
    const groupRow = page.locator('div, li').filter({ hasText: groupName }).filter({ has: page.locator('button') }).last();
    await groupRow.locator('button').last().click();
    await page.waitForTimeout(2000);

    // [Step 4] フォルダ作成メニュー
    console.log(`\n[Step 4] ポップアップメニューから「フォルダ作成」をクリックします。`);
    await page.locator('.MuiPopover-root, [role="menu"]').getByText('フォルダ作成', { exact: true }).click();
    await page.waitForTimeout(3000);

    // [Step 5] フォルダ作成入力
    console.log(`\n[Step 5] フォルダ作成情報を入力中...`);
    const folderNameInput = page.locator('label:has-text("フォルダ名")').locator('xpath=..').locator('input').first();
    await folderNameInput.waitFor({ state: 'visible' });
    await folderNameInput.click();
    await folderNameInput.fill('');
    await folderNameInput.pressSequentially(accountName, { delay: 50 });
    await page.waitForTimeout(1000);
    
    const domainLabelBox = page.locator('label:has-text("認証済み独自ドメイン")').locator('xpath=..');
    await domainLabelBox.click();
    await page.waitForTimeout(1000);
    
    await page.getByRole('option', { name: domain, exact: true }).click();
    
    const createBtn = page.getByRole('button', { name: '作成する' });
    await createBtn.click();
    console.log(`  => ⏳ フォルダ作成中...`);
    // ★修正：作成ポップアップが消えるのを待ってから次へ進む
    await createBtn.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // [Step 7-9] フォルダ検索
    console.log(`\n[Step 7-9] 記事をコピーするため、原本フォルダ「${searchKeyword}」を検索します。`);
    // ★修正（エラー原因箇所）：見えている検索窓を確実に指定し、クリックしてから入力
    const globalSearch = page.locator('input[type="search"]').filter({ state: 'visible' }).first();
    await globalSearch.waitFor({ state: 'visible', timeout: 10000 });
    await globalSearch.click();
    await globalSearch.fill('');
    await globalSearch.pressSequentially(searchKeyword, { delay: 50 });
    await page.waitForTimeout(4000);

    // 原本グループとフォルダをクリック
    const originalGroup = page.getByText('原本グループ').filter({ state: 'visible' }).first();
    if (await originalGroup.isVisible().catch(() => false)) {
        await originalGroup.click();
        await page.waitForTimeout(2000);
    }
    
    // ★修正：部分一致のフォールバックを追加して確実にフォルダへ入る
    const originalFolderLink = page.getByText(searchKeyword).filter({ state: 'visible' }).last();
    try {
        await originalFolderLink.waitFor({ timeout: 5000 });
        await originalFolderLink.click();
    } catch(e) {
        const partialKeyword = searchKeyword.split('（')[0].split('(')[0].trim();
        const partialOriginal = page.getByText(partialKeyword).filter({ state: 'visible' }).last();
        await partialOriginal.click();
    }
    await page.waitForTimeout(4000);
    
    // フォルダ内で記事検索
    const articleSearchInput = page.locator('label').filter({ hasText: '媒体/名前検索' }).locator('xpath=..').locator('input').first();
    if (await articleSearchInput.isVisible().catch(() => false)) {
        await articleSearchInput.click();
        await articleSearchInput.fill('');
        await page.waitForTimeout(500);
        await articleSearchInput.pressSequentially(targetArticle, { delay: 50 });
    } else {
        const globalSearch2 = page.locator('input[type="search"]').filter({ state: 'visible' }).last();
        await globalSearch2.click();
        await globalSearch2.fill('');
        await page.waitForTimeout(500);
        await globalSearch2.pressSequentially(targetArticle, { delay: 50 });
    }
    await page.waitForTimeout(4000);
    
    // [Step 10] メニューを開く
    console.log(`\n[Step 10] 「別フォルダへ複製」を選択します。`);
    const articleRow = page.locator('tr, div, li').filter({ hasText: targetArticle }).filter({ has: page.locator('button') }).last();
    await articleRow.waitFor({ state: 'visible', timeout: 10000 });
    
    const lastCell = articleRow.locator('td').last();
    if (await lastCell.isVisible().catch(() => false)) {
        await lastCell.locator('button').first().click();
        console.log(`  => テーブルの右端からメニューボタンを特定しました。`);
    } else {
        const chainIconCount = await articleRow.locator('button').filter({ has: page.locator('path[d^="M67.497"]') }).count();
        if (chainIconCount > 0) {
            console.log(`  => 🔗 CV連携アイコンを検知。位置を調整してメニューをクリックします。`);
            await articleRow.locator('button').nth(-3).click(); 
        } else {
            await articleRow.locator('button').nth(-2).click(); 
        }
    }
    
    await page.waitForTimeout(1000);
    await page.locator('.MuiPopover-root, [role="menu"]').getByText('別フォルダへ複製', { exact: true }).click();
    await page.waitForTimeout(3000);

    // [Step 11] 複製設定入力
    console.log(`\n[Step 11] 複製設定を入力します。`);

    console.log(`  - beyondページ名を入力します: ${targetArticle}`);
    const pageNameInput = page.getByRole('textbox', { name: 'beyondページ名', exact: true });
    await pageNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await pageNameInput.click();
    await pageNameInput.fill(''); 
    await page.waitForTimeout(500);
    await pageNameInput.pressSequentially(targetArticle, { delay: 50 });
    await page.waitForTimeout(1000);
    
    console.log(`  - チームを「フルアウト」に設定します。`);
    const teamBox = page.locator('label').filter({ hasText: /^チーム$/ }).locator('xpath=..');
    await teamBox.click();
    await page.waitForTimeout(1000);
    await page.getByRole('option', { name: 'フルアウト', exact: true }).click();
    await page.waitForTimeout(1000);

    console.log(`  - 移動先フォルダ「${accountName}」を直接検索・選択します。`);
    const folderBox = page.locator('label').filter({ hasText: /^フォルダ$/ }).locator('xpath=..');
    await folderBox.click();
    await page.waitForTimeout(500);
    const folderInput = folderBox.locator('input');
    await folderInput.click();
    await folderInput.fill('');
    await page.waitForTimeout(500);
    await folderInput.pressSequentially(accountName, { delay: 50 }); 
    await page.waitForTimeout(3000); 

    const option = page.getByRole('option').filter({ hasText: accountName }).first();
    if (await option.isVisible({ timeout: 5000 })) {
        await option.click();
        console.log(`    => リストからフォルダを特定して選択しました。`);
    } else {
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        console.log(`    => 警告：リストが見えなかったためキー操作で確定しました。`);
    }
    await page.waitForTimeout(1000);

    if (deliveryUrl) {
      console.log(`  - 配信URL設定を入力します: ${deliveryUrl}`);
      const deliveryInput = page.getByPlaceholder('半角英数字,-,_が使えます').filter({ state: 'visible' }).first();
      if (await deliveryInput.isVisible().catch(() => false)) {
          await deliveryInput.click();
          await deliveryInput.fill('');
          await page.waitForTimeout(500);
          await deliveryInput.pressSequentially(deliveryUrl, { delay: 50 });
          await page.waitForTimeout(1000);
      }
    }
    
    const copySubmitBtn = page.getByRole('button', { name: '複製する' });
    await copySubmitBtn.waitFor({ state: 'visible' });
    await page.waitForTimeout(1000);
    await copySubmitBtn.click();
    
    console.log(`\n[Step 12.5] 確認ポップアップを承認します。`);
    const confirmBtn = page.getByText('確認して複製を実行');
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
    }
    
    console.log(`  => ⏳ 複製処理の完了を待機しています...`);
    await copySubmitBtn.waitFor({ state: 'hidden', timeout: 30000 });
    console.log(`  => ✅ 複製完了！ポップアップが閉じました。`);
    await page.waitForTimeout(5000); 

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
