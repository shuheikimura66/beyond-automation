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
  // 1. 変数の設定（★コピー元とコピー先の変数を分けました）
  // =========================================================
  const rowIdx = process.env.ROW_IDX; 
  const groupListName = process.env.GROUP_LIST_NAME; 
  const sourceFolder = process.env.FOLDER_NAME_SOURCE; // ★F列: フォルダ名（コピー元）
  const destFolder = process.env.FOLDER_NAME_DEST;     // ★G列: フォルダ名（コピー先）
  const sourceArticle = process.env.SOURCE_ARTICLE;    // H列: 記事名（コピー元）
  const newArticleName = process.env.NEW_ARTICLE_NAME; // I列: beyondページ名（新規）
  const deliveryUrl = process.env.DELIVERY_URL;        // J列: 配信URL設定
  const gasUrl = process.env.GAS_WEBAPP_URL;

  // コピー元とコピー先が同じかどうかを判定
  const isSameFolder = (sourceFolder === destFolder);

  const targetUrl = 'https://app.squadbeyond.com/';

  try {
    console.log(`\n=========================================`);
    console.log(`🚀 beyondページ複製 RPA開始 (対象行: ${rowIdx})`);
    console.log(`=========================================`);

    // [Step 0] ログイン
    console.log(`\n[Step 0] ターゲットURLにアクセスします: ${targetUrl}`);
    await page.goto(targetUrl);
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible()) {
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

    // [Step 1] フォルダ名（コピー元）検索
    console.log(`\n[Step 1] 検索窓にコピー元フォルダ「${sourceFolder}」を入力します。`);
    const globalSearch = page.locator('input[type="search"]').first();
    await globalSearch.fill('');
    await globalSearch.pressSequentially(sourceFolder, { delay: 50 });
    await page.waitForTimeout(4000);

    // [Step 2] 親グループの展開
    const folderLink = page.getByText(sourceFolder).filter({ state: 'visible' }).last();
    if (!(await folderLink.isVisible().catch(() => false))) {
        console.log(`\n[Step 2] 親グループ「${groupListName}」を展開します。`);
        const parentGroup = page.locator('p.MuiTypography-body1').filter({ hasText: groupListName }).first();
        if (await parentGroup.isVisible().catch(() => false)) {
            await parentGroup.click();
            await page.waitForTimeout(2000);
        }
    }

    // [Step 2.5] 子フォルダクリック
    console.log(`\n[Step 2.5] フォルダ名をクリックして中に入ります。`);
    try {
        await folderLink.waitFor({ timeout: 5000 });
        await folderLink.click();
    } catch (e) {
        const partialName = sourceFolder.split('（')[0].split('(')[0].trim();
        const partialLink = page.getByText(partialName).filter({ state: 'visible' }).last();
        await partialLink.waitFor({ timeout: 5000 });
        await partialLink.click();
    }
    console.log(`  => フォルダの中身（記事一覧）のロードを待機しています...`);
    await page.waitForTimeout(5000); 

    // [Step 3] 記事名検索
    console.log(`\n[Step 3] フォルダ内で記事「${sourceArticle}」を検索します。`);
    const articleSearchInput = page.locator('label').filter({ hasText: '媒体/名前検索' }).locator('xpath=..').locator('input').first();
    if (await articleSearchInput.isVisible().catch(() => false)) {
        await articleSearchInput.click();
        await articleSearchInput.fill('');
        await page.waitForTimeout(500);
        await articleSearchInput.pressSequentially(sourceArticle, { delay: 50 });
    } else {
        const globalSearch2 = page.locator('input[type="search"]').last();
        await globalSearch2.click();
        await globalSearch2.fill('');
        await page.waitForTimeout(500);
        await globalSearch2.pressSequentially(sourceArticle, { delay: 50 });
    }
    await page.waitForTimeout(4000);

    // [Step 4] 複製メニューを開く
    console.log(`\n[Step 4] 対象記事のメニューを開きます。`);
    const articleRow = page.locator('tr, div, li').filter({ hasText: sourceArticle }).filter({ has: page.locator('button') }).last();
    await articleRow.waitFor({ state: 'visible', timeout: 10000 });

    const lastCell = articleRow.locator('td').last();
    if (await lastCell.isVisible().catch(() => false)) {
        await lastCell.locator('button').first().click();
    } else {
        const chainIconCount = await articleRow.locator('button').filter({ has: page.locator('path[d^="M67.497"]') }).count();
        if (chainIconCount > 0) {
            await articleRow.locator('button').nth(-3).click(); 
        } else {
            await articleRow.locator('button').nth(-2).click(); 
        }
    }
    await page.waitForTimeout(1000);

    // =========================================================
    // [Step 4.5 & 5] パターンごとの複製処理
    // =========================================================
    if (isSameFolder) {
        // ▼ パターンA：同じフォルダ内に複製する場合
        console.log(`  => 【パターンA】同じフォルダ内なので「beyondページ複製」を選択します。`);
        await page.locator('a').filter({ hasText: 'beyondページ複製' }).first().click();
        await page.waitForTimeout(3000);

        console.log(`\n[Step 5] 複製ポップアップに新規情報を入力します。`);
        const pageNameInput = page.getByRole('textbox', { name: 'beyondページ名', exact: true });
        await pageNameInput.waitFor({ state: 'visible', timeout: 5000 });
        await pageNameInput.click();
        await pageNameInput.fill('');
        await page.waitForTimeout(500);
        await pageNameInput.pressSequentially(newArticleName, { delay: 50 });
        await page.waitForTimeout(1000);
        
        if (deliveryUrl) {
            const deliveryInput = page.getByPlaceholder('半角英数字,-,_が使えます');
            if (await deliveryInput.isVisible().catch(() => false)) {
                await deliveryInput.click();
                await deliveryInput.fill('');
                await page.waitForTimeout(500);
                await deliveryInput.pressSequentially(deliveryUrl, { delay: 50 });
            }
        }
    } else {
        // ▼ パターンB：別フォルダへ複製する場合
        console.log(`  => 【パターンB】別フォルダへ移動するため「別フォルダへ複製」を選択します。`);
        await page.locator('.MuiPopover-root, [role="menu"]').getByText('別フォルダへ複製', { exact: true }).click();
        await page.waitForTimeout(3000);

        console.log(`\n[Step 5] 複製ポップアップに情報を入力します。`);
        const pageNameInput = page.getByRole('textbox', { name: 'beyondページ名', exact: true });
        await pageNameInput.waitFor({ state: 'visible', timeout: 5000 });
        await pageNameInput.click();
        await pageNameInput.fill('');
        await page.waitForTimeout(500);
        await pageNameInput.pressSequentially(newArticleName, { delay: 50 });
        
        console.log(`  - チームを「フルアウト」に設定します。`);
        const teamBox = page.locator('label').filter({ hasText: /^チーム$/ }).locator('xpath=..');
        await teamBox.click();
        await page.waitForTimeout(1000);
        await page.getByRole('option', { name: 'フルアウト', exact: true }).click();
        await page.waitForTimeout(1000);

        console.log(`  - 移動先フォルダ「${destFolder}」を選択します。`);
        const folderBox = page.locator('label').filter({ hasText: /^フォルダ$/ }).locator('xpath=..');
        await folderBox.click();
        await page.waitForTimeout(500);
        const folderInput = folderBox.locator('input');
        await folderInput.fill('');
        await folderInput.pressSequentially(destFolder, { delay: 50 });
        await page.waitForTimeout(3000); 

        const option = page.getByRole('option').filter({ hasText: destFolder }).first();
        if (await option.isVisible({ timeout: 5000 })) {
            await option.click();
        } else {
            await page.keyboard.press('ArrowDown');
            await page.keyboard.press('Enter');
        }
        await page.waitForTimeout(1000);

        if (deliveryUrl) {
            const deliveryInput = page.getByPlaceholder('半角英数字,-,_が使えます');
            if (await deliveryInput.isVisible().catch(() => false)) {
                await deliveryInput.fill('');
                await page.waitForTimeout(500);
                await deliveryInput.pressSequentially(deliveryUrl, { delay: 50 });
            }
        }
    }

    // 共通：複製ボタンを押す
    await page.waitForTimeout(1000);
    console.log(`  - 「複製する」ボタンを押します。`);
    const copySubmitBtn = page.getByRole('button', { name: '複製する' });
    await copySubmitBtn.click();
    
    const confirmBtn = page.getByText('確認して複製を実行');
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
    }
    
    console.log(`  => ⏳ 複製処理の完了を待機しています...`);
    await copySubmitBtn.waitFor({ state: 'hidden', timeout: 30000 });
    console.log(`  => ✅ 複製完了！`);
    await page.waitForTimeout(5000);

    // =========================================================
    // [Step 5.5] 別フォルダへ複製した場合は、そのフォルダへ移動
    // =========================================================
    if (!isSameFolder) {
        console.log(`\n[Step 5.5] 別フォルダへ移動します: ${destFolder}`);
        const globalSearchDest = page.locator('input[type="search"]').first();
        await globalSearchDest.click();
        await globalSearchDest.fill('');
        await page.waitForTimeout(500);
        await globalSearchDest.pressSequentially(destFolder, { delay: 50 });
        await page.waitForTimeout(4000);

        const destFolderLink = page.getByText(destFolder).filter({ state: 'visible' }).last();
        try {
            await destFolderLink.waitFor({ timeout: 5000 });
            await destFolderLink.click();
        } catch (e) {
            const partialDest = destFolder.split('（')[0].split('(')[0].trim();
            const partialDestLink = page.getByText(partialDest).filter({ state: 'visible' }).last();
            await partialDestLink.click();
        }
        console.log(`  => フォルダの中身のロードを待機しています...`);
        await page.waitForTimeout(5000);
    }

    // =========================================================
    // [Step 6] 複製された記事の検索とURLコピー
    // =========================================================
    console.log(`\n[Step 6] 複製されたページ「${newArticleName}」を検索してURLをコピーします。`);
    const articleSearchInput2 = page.locator('label').filter({ hasText: '媒体/名前検索' }).locator('xpath=..').locator('input').first();
    
    if (await articleSearchInput2.isVisible().catch(() => false)) {
        await articleSearchInput2.click();
        await articleSearchInput2.fill('');
        await page.waitForTimeout(500);
        await articleSearchInput2.pressSequentially(newArticleName, { delay: 50 });
    } else {
        const globalSearch3 = page.locator('input[type="search"]').last();
        await globalSearch3.click();
        await globalSearch3.fill('');
        await page.waitForTimeout(500);
        await globalSearch3.pressSequentially(newArticleName, { delay: 50 });
    }
    await page.waitForTimeout(4000);

    const newArticleRow = page.locator('tr, div, li').filter({ hasText: newArticleName }).filter({ has: page.locator('button') }).last();
    await newArticleRow.waitFor({ state: 'visible', timeout: 10000 });

    const newLastCell = newArticleRow.locator('td').last();
    if (await newLastCell.isVisible().catch(() => false)) {
        await newLastCell.locator('button').first().click();
    } else {
        const chainIconCount = await newArticleRow.locator('button').filter({ has: page.locator('path[d^="M67.497"]') }).count();
        if (chainIconCount > 0) {
            await newArticleRow.locator('button').nth(-3).click(); 
        } else {
            await newArticleRow.locator('button').nth(-2).click(); 
        }
    }
    await page.waitForTimeout(1000);

    console.log(`  - URLコピーのアイコンをクリックします。`);
    await page.locator('.MuiPopover-root, [role="menu"]').locator('[data-testid="FileCopyIcon"]').locator('xpath=..').first().click();
    await page.waitForTimeout(1000);

    const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
    console.log(`  => 🎉 取得したURL: ${copiedUrl}`);

    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: copiedUrl, status: 'success', task_type: 'duplicate' });
    }

  } catch (error) {
    console.error(`\n❌ エラー発生:\n`, error);
    await page.screenshot({ path: 'duplicate-error-screenshot.png', fullPage: true });
    
    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: "", status: 'error', task_type: 'duplicate' });
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
