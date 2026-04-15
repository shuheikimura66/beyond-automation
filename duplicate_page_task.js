const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch(); 
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // =========================================================
  // 1. 変数の設定
  // =========================================================
  const rowIdx = process.env.ROW_IDX; 
  const groupListName = process.env.GROUP_LIST_NAME; // ★E列: 親グループ名
  const folderName = process.env.FOLDER_NAME;        // F列: フォルダ名
  const sourceArticle = process.env.SOURCE_ARTICLE;  // G列: 記事名（コピー元）
  const newArticleName = process.env.NEW_ARTICLE_NAME; // H列: 新規ページ名
  const deliveryUrl = process.env.DELIVERY_URL;      // I列: 配信URL設定
  const gasUrl = process.env.GAS_WEBAPP_URL;

  const targetUrl = 'https://app.squadbeyond.com/';

  try {
    console.log(`\n=========================================`);
    console.log(`🚀 beyondページ複製 RPA開始 (対象行: ${rowIdx})`);
    console.log(`=========================================`);

    // =========================================================
    // [Step 0] ログイン処理
    // =========================================================
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

    // =========================================================
    // [Step 1] フォルダ名を検索
    // =========================================================
    console.log(`\n[Step 1] 検索窓にフォルダ名「${folderName}」を入力します。`);
    const globalSearch = page.locator('input[type="search"]').first();
    await globalSearch.fill('');
    await globalSearch.pressSequentially(folderName, { delay: 50 });
    await page.waitForTimeout(4000); // 検索結果が絞り込まれるのを待機

    // =========================================================
    // [Step 2] スプシで指定された親グループを開く
    // =========================================================
    // すでにフォルダが見えているかチェック
    const folderLink = page.getByText(folderName).filter({ state: 'visible' }).last();

    if (!(await folderLink.isVisible().catch(() => false))) {
        console.log(`\n[Step 2] 親グループ「${groupListName}」を展開します。`);
        
        // ★大改修：スプシに入力されたグループ名を直接探してクリック！
        const parentGroup = page.locator('p.MuiTypography-body1').filter({ hasText: groupListName }).first();
        
        if (await parentGroup.isVisible().catch(() => false)) {
            await parentGroup.click();
            console.log(`  => 親グループをクリックして展開しました。`);
            await page.waitForTimeout(2000); // アニメーション待機
        } else {
            console.log(`  => ⚠️ 親グループが見つかりません。すでに展開されているか、文字が違う可能性があります。`);
        }
    }

    // =========================================================
    // [Step 2.5] 子フォルダをクリック
    // =========================================================
    console.log(`\n[Step 2.5] フォルダ名をクリックして中に入ります。`);
    try {
        await folderLink.waitFor({ timeout: 5000 });
        await folderLink.click();
        console.log(`  => フォルダ名（完全一致）をクリックしました。`);
    } catch (e) {
        const partialName = folderName.split('（')[0].split('(')[0].trim();
        console.log(`  => ⚠️完全一致で見つからなかったため、部分一致「${partialName}」で再試行します。`);
        
        const partialLink = page.getByText(partialName).filter({ state: 'visible' }).last();
        await partialLink.waitFor({ timeout: 5000 });
        await partialLink.click();
        console.log(`  => フォルダ名（部分一致）をクリックしました。`);
    }
    await page.waitForTimeout(3000); 

    // =========================================================
    // [Step 3] フォルダ内で記事名を検索
    // =========================================================
    console.log(`\n[Step 3] フォルダ内で記事「${sourceArticle}」を検索します。`);
    const articleSearchInput = page.locator('label').filter({ hasText: '媒体/名前検索' }).locator('xpath=..').locator('input').first();
    
    if (await articleSearchInput.isVisible().catch(() => false)) {
        await articleSearchInput.fill('');
        await articleSearchInput.pressSequentially(sourceArticle, { delay: 50 });
    } else {
        const globalSearch2 = page.locator('input[type="search"]').last();
        await globalSearch2.fill('');
        await globalSearch2.pressSequentially(sourceArticle, { delay: 50 });
    }
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 4] 右側のメニューボタン ＞ 「beyondページ複製」をクリック
    // =========================================================
    console.log(`\n[Step 4] 対象記事のメニューを開き、「beyondページ複製」をクリックします。`);
    
    const articleRow = page.locator('tr, div, li').filter({ hasText: sourceArticle }).filter({ has: page.locator('button') }).last();
    
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

    console.log(`  => メニュー内から「beyondページ複製」を選択します。`);
    await page.locator('a').filter({ hasText: 'beyondページ複製' }).first().click();
    
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 5] 複製ポップアップの操作
    // =========================================================
    console.log(`\n[Step 5] 複製ポップアップに新規情報を入力します。（構築中）`);
    console.log(`  - 予定入力値: 新規ページ名 = ${newArticleName}`);
    console.log(`  - 予定入力値: 配信URL = ${deliveryUrl}`);
    
    // TODO: ここにポップアップ入力処理を追加

    console.log(`\n🎉 テスト稼働（Step 4まで）完了しました！`);

    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: "", status: 'success', task_type: 'duplicate' });
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
