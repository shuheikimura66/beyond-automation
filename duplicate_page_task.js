const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch(); 
  // クリップボードへのアクセス権限を付与
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();

  // =========================================================
  // 1. 変数の設定
  // =========================================================
  const rowIdx = process.env.ROW_IDX; 
  const groupListName = process.env.GROUP_LIST_NAME; 
  const folderName = process.env.FOLDER_NAME; 
  const sourceArticle = process.env.SOURCE_ARTICLE; 
  const newArticleName = process.env.NEW_ARTICLE_NAME; 
  const deliveryUrl = process.env.DELIVERY_URL; 
  const gasUrl = process.env.GAS_WEBAPP_URL;

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

    // [Step 1] フォルダ名検索
    console.log(`\n[Step 1] 検索窓にフォルダ名「${folderName}」を入力します。`);
    const globalSearch = page.locator('input[type="search"]').first();
    await globalSearch.fill('');
    await globalSearch.pressSequentially(folderName, { delay: 50 });
    await page.waitForTimeout(4000);

    // [Step 2] 親グループの展開
    const folderLink = page.getByText(folderName).filter({ state: 'visible' }).last();
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
        const partialName = folderName.split('（')[0].split('(')[0].trim();
        const partialLink = page.getByText(partialName).filter({ state: 'visible' }).last();
        await partialLink.waitFor({ timeout: 5000 });
        await partialLink.click();
    }
    // ★大改修：フォルダに入った直後は記事一覧のロードに時間がかかるため、5秒待機する
    console.log(`  => フォルダの中身（記事一覧）のロードを待機しています...`);
    await page.waitForTimeout(5000); 

    // [Step 3] 記事名検索
    console.log(`\n[Step 3] フォルダ内で記事「${sourceArticle}」を検索します。`);
    const articleSearchInput = page.locator('label').filter({ hasText: '媒体/名前検索' }).locator('xpath=..').locator('input').first();
    if (await articleSearchInput.isVisible().catch(() => false)) {
        // ★大改修：確実に入力するため、一度フォーカスしてから文字を消して入力
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
    // ★大改修：検索結果の絞り込み反映を長めに待機
    await page.waitForTimeout(4000);

    // [Step 4] 複製メニュークリック
    console.log(`\n[Step 4] 対象記事のメニューを開き、「beyondページ複製」をクリックします。`);
    const articleRow = page.locator('tr, div, li').filter({ hasText: sourceArticle }).filter({ has: page.locator('button') }).last();
    
    // ★大改修：記事が画面に現れるまで最大10秒待機する
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
    await page.locator('a').filter({ hasText: 'beyondページ複製' }).first().click();
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 5] 複製ポップアップの操作
    // =========================================================
    console.log(`\n[Step 5] 複製ポップアップに新規情報を入力します。`);
    
    console.log(`  - beyondページ名を入力します: ${newArticleName}`);
    const pageNameInput = page.getByRole('textbox', { name: 'beyondページ名', exact: true });
    await pageNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await pageNameInput.click();
    await pageNameInput.fill('');
    await page.waitForTimeout(500);
    await pageNameInput.pressSequentially(newArticleName, { delay: 50 });
    await page.waitForTimeout(1000);
    
    if (deliveryUrl) {
      console.log(`  - 配信URL設定を入力します: ${deliveryUrl}`);
      const deliveryInput = page.getByPlaceholder('半角英数字,-,_が使えます');
      if (await deliveryInput.isVisible().catch(() => false)) {
          await deliveryInput.click();
          await deliveryInput.fill('');
          await page.waitForTimeout(500);
          await deliveryInput.pressSequentially(deliveryUrl, { delay: 50 });
      }
    }
    await page.waitForTimeout(1000);

    console.log(`  - 「複製する」ボタンを押します。`);
    const copySubmitBtn = page.getByRole('button', { name: '複製する' });
    await copySubmitBtn.click();
    
    // 確認ポップアップが出る場合
    const confirmBtn = page.getByText('確認して複製を実行');
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
    }
    
    console.log(`  => ⏳ 複製処理の完了を待機しています...`);
    // ★大改修：ポップアップが完全に消えるまで待機（複製完了の証）
    await copySubmitBtn.waitFor({ state: 'hidden', timeout: 30000 });
    console.log(`  => ✅ ポップアップが消えました。一覧の更新を待ちます...`);
    await page.waitForTimeout(5000);

    // =========================================================
    // [Step 6] 複製された記事の検索とURLコピー
    // =========================================================
    console.log(`\n[Step 6] 複製されたページ「${newArticleName}」を検索してURLをコピーします。`);
    
    // ★大改修：画面が更新されて古い検索窓が消えているため、「再取得」する
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

    // メニューを開く
    const newArticleRow = page.locator('tr, div, li').filter({ hasText: newArticleName }).filter({ has: page.locator('button') }).last();
    
    // ★大改修：新しい記事が表示されるまで確実に待つ
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

    // クリップボードからコピーした内容を取得
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
