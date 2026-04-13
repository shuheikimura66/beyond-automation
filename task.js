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
  const accountName = process.env.ACCOUNT_NAME;
  const searchKeyword = process.env.SEARCH_KEYWORD;
  const targetArticle = process.env.TARGET_ARTICLE;
  const deliveryUrl = process.env.DELIVERY_URL; 
  const gasUrl = process.env.GAS_WEBAPP_URL;

  // 原本URLはハードコード
  const targetUrl = 'https://app.squadbeyond.com/';

  try {
    console.log(`\n=========================================`);
    console.log(`🚀 RPA開始 (対象行: ${rowIdx})`);
    console.log(`=========================================`);

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

    console.log(`\n[Step 2] 検索窓に「木村」と入力して絞り込みます。`);
    await page.locator('input[type="search"]').first().fill('');
    await page.locator('input[type="search"]').first().pressSequentially('木村', { delay: 50 });
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
    await folderNameInput.fill('');
    await folderNameInput.pressSequentially(accountName, { delay: 50 });
    await page.waitForTimeout(1000);
    
    const domainLabelBox = page.locator('label:has-text("認証済み独自ドメイン")').locator('xpath=..');
    await domainLabelBox.click();
    await page.waitForTimeout(1000);
    
    // ★修正ポイント：{ exact: true } を追加して、似たドメイン（部分一致）を完全に無視する！
    await page.getByRole('option', { name: domain, exact: true }).click();
    
    await page.getByRole('button', { name: '作成する' }).click();
    console.log(`  => ⏳ フォルダ作成中...`);
    await page.waitForTimeout(5000);

    console.log(`\n[Step 7-9] 記事「${targetArticle}」を検索します。`);
    const globalSearch = page.locator('input[type="search"]').first();
    await globalSearch.fill('');
    await globalSearch.pressSequentially(searchKeyword, { delay: 50 });
    await page.waitForTimeout(3000);

    await page.getByText('原本グループ').click();
    await page.waitForTimeout(2000);
    await page.locator('div, li').filter({ hasText: searchKeyword }).filter({ has: page.locator('button') }).last().click();
    await page.waitForTimeout(3000);
    
    const articleSearchInput = page.locator('label').filter({ hasText: '媒体/名前検索' }).locator('xpath=..').locator('input').first();
    await articleSearchInput.fill('');
    await articleSearchInput.pressSequentially(targetArticle, { delay: 50 });
    await page.waitForTimeout(3000);
    
    console.log(`\n[Step 10] 「別フォルダへ複製」を選択します。`);
    const articleRow = page.locator('tr, div, li').filter({ hasText: targetArticle }).filter({ has: page.locator('button') }).last();
    
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

    console.log(`\n[Step 11] 複製設定を入力します。`);

    console.log(`  - beyondページ名を入力します: ${targetArticle}`);
    const pageNameInput = page.getByRole('textbox', { name: 'beyondページ名', exact: true });
    await pageNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await pageNameInput.fill(''); 
    await page.waitForTimeout(500);
    await pageNameInput.pressSequentially(targetArticle, { delay: 50 });
    await page.waitForTimeout(1000);
    
    console.log(`  - チームを「フルアウト」に設定します。`);
    const teamBox = page.locator('label').filter({ hasText: /^チーム$/ }).locator('xpath=..');
    await teamBox.click();
    await page.waitForTimeout(1000);
    // ★ここも念のため完全一致（exact: true）に変更
    await page.getByRole('option', { name: 'フルアウト', exact: true }).click();
    await page.waitForTimeout(1000);

    console.log(`  - 移動先フォルダ「${accountName}」を直接検索・選択します。`);
    const folderBox = page.locator('label').filter({ hasText: /^フォルダ$/ }).locator('xpath=..');
    await folderBox.click();
    await page.waitForTimeout(500);
    const folderInput = folderBox.locator('input');
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
      const deliveryInput = page.getByPlaceholder('半角英数字,-,_が使えます');
      await deliveryInput.fill('');
      await page.waitForTimeout(500);
      await deliveryInput.pressSequentially(deliveryUrl, { delay: 50 });
      await page.waitForTimeout(1000);
    }
    
    const copySubmitBtn = page.getByRole('button', { name: '複製する' });
    await copySubmitBtn.waitFor({ state: 'visible' });
    await page.waitForTimeout(1000);
    await copySubmitBtn.click();
    
    console.log(`\n[Step 12.5] 確認ポップアップを承認します。`);
    const confirmBtn = page.getByText('確認して複製を実行');
    await confirmBtn.waitFor({ state: 'visible' });
    await page.waitForTimeout(1000);
    await confirmBtn.click();
    
    console.log(`  => ⏳ 複製処理の完了を待機しています...`);
    await confirmBtn.waitFor({ state: 'hidden', timeout: 30000 });
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
