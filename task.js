const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();

  // =========================================================
  // 1. 変数の設定
  // =========================================================
  const rowIdx = process.env.ROW_IDX;
  
  const groupListSource = process.env.GROUP_LIST_NAME_SOURCE; 
  const sourceFolder = process.env.FOLDER_NAME_SOURCE;       
  const sourceArticle = process.env.SOURCE_ARTICLE;          
  
  const domain = process.env.DOMAIN;                         
  const groupListDest = process.env.GROUP_LIST_NAME_DEST;    
  const destFolder = process.env.FOLDER_NAME_DEST;           
  
  const deliveryUrl = process.env.DELIVERY_URL;              
  const accountName = process.env.ACCOUNT_NAME;              
  
  const gasUrl = process.env.GAS_WEBAPP_URL;
  const targetUrl = 'https://app.squadbeyond.com/';

  try {
    console.log(`\n=========================================`);
    console.log(`🚀 RPA開始 (対象行: ${rowIdx})`);
    console.log(`=========================================`);

    // [Step 1] ログイン
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

    // =========================================================
    // ★追加: [Step 1.5] 新UI対応（ページメニューのクリック）
    // =========================================================
    console.log(`\n[Step 1.5] 新UI対応：「ページ」メニューをクリックして一覧へ移動します。`);
    // ご提示いただいたSVGパスを持つアイコンを探す
    const pageMenuIcon = page.locator('svg').filter({ has: page.locator('path[d^="M11 8.5V6.75C11 5.50736"]') }).first();
    
    // アイコンの親要素（ボタンやリンク）を探してクリック、見つからなければ直接クリック
    try {
        const menuWrapper = pageMenuIcon.locator('xpath=ancestor::button | ancestor::a | ancestor::div[@role="button" or @role="menuitem"]').first();
        if (await menuWrapper.isVisible({ timeout: 3000 }).catch(() => false)) {
            await menuWrapper.click();
        } else {
            await pageMenuIcon.click();
        }
    } catch(e) {
        await pageMenuIcon.click();
    }
    console.log(`  => ページ一覧画面のロードを待機しています...`);
    await page.waitForTimeout(5000);

    // =========================================================
    // [Step 2-5] コピー先へのフォルダ作成処理
    // =========================================================
    console.log(`\n[Step 2] 検索窓に親グループ「${groupListDest}」を入力して絞り込みます。`);
    await page.locator('input[type="search"]').first().fill('');
    await page.locator('input[type="search"]').first().pressSequentially(groupListDest, { delay: 50 });
    await page.waitForTimeout(3000);

    console.log(`\n[Step 3] グループ名「${groupListDest}」のメニューを開きます。`);
    const groupRow = page.locator('div, li').filter({ hasText: groupListDest }).filter({ has: page.locator('button') }).last();
    await groupRow.locator('button').last().click();
    await page.waitForTimeout(2000);

    console.log(`\n[Step 4] ポップアップメニューから「フォルダ作成」をクリックします。`);
    await page.locator('.MuiPopover-root, [role="menu"]').getByText('フォルダ作成', { exact: true }).click();
    await page.waitForTimeout(3000);

    console.log(`\n[Step 5] フォルダ作成情報を入力中...`);
    const folderNameInput = page.locator('label:has-text("フォルダ名")').locator('xpath=..').locator('input').last();
    await folderNameInput.fill('');
    await folderNameInput.pressSequentially(destFolder, { delay: 50 });
    await page.waitForTimeout(1000);
    
    const domainLabelBox = page.locator('label:has-text("認証済み独自ドメイン")').locator('xpath=..').last();
    await domainLabelBox.click();
    await page.waitForTimeout(1000);
    
    await page.getByRole('option', { name: domain, exact: true }).last().click();
    await page.waitForTimeout(1000);
    
    const createBtn = page.getByRole('button', { name: '作成する' }).last();
    await createBtn.click();
    console.log(`  => ⏳ フォルダ作成中...`);
    
    await createBtn.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // =========================================================
    // [Step 6] コピー元フォルダの検索
    // =========================================================
    console.log(`\n[Step 6] 記事をコピーするため、原本グループ「${groupListSource}」を検索します。`);
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const globalSearch = page.locator('input[type="search"]').first();
    await globalSearch.fill('');
    await globalSearch.pressSequentially(groupListSource, { delay: 50 });
    await page.waitForTimeout(4000);

    const originalGroup = page.locator('p.MuiTypography-body1').filter({ hasText: groupListSource }).first();
    if (await originalGroup.isVisible().catch(() => false)) {
        await originalGroup.click();
        await page.waitForTimeout(2000);
    }
    
    console.log(`  => フォルダ「${sourceFolder}」をクリックします。`);
    try {
        await page.locator('div, li').filter({ hasText: sourceFolder }).filter({ has: page.locator('button') }).last().click();
    } catch(e) {
        const partialKeyword = sourceFolder.split('（')[0].split('(')[0].trim();
        await page.locator('div, li').filter({ hasText: partialKeyword }).filter({ has: page.locator('button') }).last().click();
    }
    console.log(`  => フォルダの中身のロードを待機しています...`);
    await page.waitForTimeout(5000);
    
    // =========================================================
    // [Step 7] 記事検索とメニュー展開
    // =========================================================
    console.log(`\n[Step 7] フォルダ内で記事「${sourceArticle}」を検索します。`);
    const articleSearchInput = page.locator('label').filter({ hasText: '媒体/名前検索' }).locator('xpath=..').locator('input').first();
    await articleSearchInput.fill('');
    await articleSearchInput.pressSequentially(sourceArticle, { delay: 50 });
    await page.waitForTimeout(4000);
    
    console.log(`\n[Step 8] 「別フォルダへ複製」を選択します。`);
    const articleRow2 = page.locator('tr, div, li').filter({ hasText: sourceArticle }).filter({ has: page.locator('button') }).last();
    
    const lastCell = articleRow2.locator('td').last();
    if (await lastCell.isVisible().catch(() => false)) {
        await lastCell.locator('button').first().click();
    } else {
        const chainIconCount = await articleRow2.locator('button').filter({ has: page.locator('path[d^="M67.497"]') }).count();
        if (chainIconCount > 0) {
            await articleRow2.locator('button').nth(-3).click(); 
        } else {
            await articleRow2.locator('button').nth(-2).click(); 
        }
    }
    
    await page.waitForTimeout(1000);
    await page.locator('.MuiPopover-root, [role="menu"]').getByText('別フォルダへ複製', { exact: true }).click();
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 9] 複製設定の入力
    // =========================================================
    console.log(`\n[Step 9] 複製設定を入力します。`);

    console.log(`  - beyondページ名を入力します: ${sourceArticle}`);
    const pageNameInput = page.getByRole('textbox', { name: 'beyondページ名', exact: true }).last();
    await pageNameInput.fill(''); 
    await pageNameInput.pressSequentially(sourceArticle, { delay: 50 });
    await page.waitForTimeout(1000);
    
    console.log(`  - チームを「フルアウト」に設定します。`);
    const teamBox = page.locator('label').filter({ hasText: /^チーム$/ }).locator('xpath=..').last();
    await teamBox.click();
    await page.waitForTimeout(1000);
    await page.getByRole('option', { name: 'フルアウト', exact: true }).last().click();
    await page.waitForTimeout(1000);

    console.log(`  - 移動先フォルダ「${destFolder}」を直接検索・選択します。`);
    const folderBox = page.locator('label').filter({ hasText: /^フォルダ$/ }).locator('xpath=..').last();
    await folderBox.click();
    await page.waitForTimeout(500);
    const folderInput = folderBox.locator('input').last();
    await folderInput.fill('');
    await folderInput.pressSequentially(destFolder, { delay: 50 }); 
    await page.waitForTimeout(3000); 

    const option = page.getByRole('option').filter({ hasText: destFolder }).last();
    if (await option.isVisible({ timeout: 5000 })) {
        await option.click();
    } else {
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(1000);

    if (deliveryUrl) {
      console.log(`  - 配信URL設定を入力します: ${deliveryUrl}`);
      const deliveryInput = page.getByPlaceholder('半角英数字,-,_が使えます').last();
      await deliveryInput.fill('');
      await deliveryInput.pressSequentially(deliveryUrl, { delay: 50 });
      await page.waitForTimeout(1000);
    }
    
    const copySubmitBtn = page.getByRole('button', { name: '複製する' }).last();
    await copySubmitBtn.click();
    
    const confirmBtn = page.getByText('確認して複製を実行').last();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
    }
    
    console.log(`  => ⏳ 複製処理の完了を待機しています...`);
    await confirmBtn.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    console.log(`  => ✅ 複製完了！ポップアップが閉じました。`);
    await page.waitForTimeout(5000); 

    await page.screenshot({ path: 'final-check.png', fullPage: true });

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
