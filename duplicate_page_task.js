const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1372, height: 841 },
    permissions: ['clipboard-read', 'clipboard-write']
  });
  let page = await context.newPage();

  // =========================================================
  // 1. 変数の設定
  // =========================================================
  const rowIdx          = process.env.ROW_IDX;
  const groupListSource = process.env.GROUP_LIST_NAME_SOURCE; 
  const sourceFolder    = process.env.FOLDER_NAME_SOURCE;
  const sourceArticle   = process.env.SOURCE_ARTICLE;

  const groupListDest   = process.env.GROUP_LIST_NAME_DEST;
  const destFolder      = process.env.FOLDER_NAME_DEST;
  const newArticleName  = process.env.NEW_ARTICLE_NAME;

  const deliveryUrl     = process.env.DELIVERY_URL;
  const gasUrl          = process.env.GAS_WEBAPP_URL;

  const targetUrl = 'https://app.squadbeyond.com/';

  try {
    console.log(`\n=========================================`);
    console.log(`🚀 beyondページ複製 RPA開始 (対象行: ${rowIdx})`);
    console.log(`=========================================`);

    // =========================================================
    // [Step 1] ログイン処理（人間らしい入力でフリーズ回避）
    // =========================================================
    console.log(`\n[Step 1] ターゲットURLにアクセスします: ${targetUrl}`);
    await page.goto(targetUrl);
    
    try {
        await page.waitForSelector('input[name="email"], input[type="email"], [data-testid="list-menu-item"]', { timeout: 15000 });
    } catch(e) {}

    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    const passInput = page.locator('input[name="password"], input[type="password"]').first();

    // 1回目のログイン
    if (await emailInput.isVisible().catch(() => false)) {
      console.log(`  => 🔑 ログイン画面を検知。一度ログインします。`);
      await emailInput.click();
      await emailInput.fill(process.env.SQUADBEYOND_ID);
      await page.waitForTimeout(500);
      
      await passInput.click();
      await passInput.fill(process.env.SQUADBEYOND_PASS);
      // ★システムの文字認識を待つ（フリーズ対策）
      await page.waitForTimeout(1000); 
      
      console.log(`  => ⏳ Enterキーでログインを実行し、通信を待機します...`);
      // ★ボタンクリックではなくEnterキーで自然に送信する
      await passInput.press('Enter'); 
      
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(4000);
    }

    console.log(`\n[Step 1.1] システムバグ回避のため、強制ログアウトを実行します。`);
    try {
      const profileIcon = page.locator('div').filter({ hasText: /^小$/ }).last();
      if (await profileIcon.isVisible().catch(() => false)) {
        await profileIcon.click();
      } else {
        await page.locator('[data-testid="list-menu-item"]').nth(-2).click();
      }
      await page.waitForTimeout(1500);
      const logoutBtn = page.getByText('ログアウト', { exact: true }).last();
      await logoutBtn.click();
      console.log(`  => ✅ ログアウト完了`);
      await page.waitForLoadState('load');
      await page.waitForTimeout(3000);
    } catch(e) {
      console.log(`  => ⚠️ ログアウトスキップ（すでにログアウト済み等）`);
    }

    console.log(`\n[Step 1.2] クリーンな状態で再度ログインを実行します。`);
    try {
        await page.waitForSelector('input[name="email"], input[type="email"], [data-testid="list-menu-item"]', { timeout: 10000 });
    } catch(e) {}
    
    // 2回目のログイン（同様にフリーズ対策を適用）
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.click();
      await emailInput.fill(process.env.SQUADBEYOND_ID);
      await page.waitForTimeout(500);
      
      await passInput.click();
      await passInput.fill(process.env.SQUADBEYOND_PASS);
      await page.waitForTimeout(1000); 
      
      console.log(`  => ⏳ Enterキーで再度ログインを実行します...`);
      await passInput.press('Enter');
      
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(4000);
    }

    console.log(`\n[Step 1.2.5] ワークスペース前工程（フルアウトが未表示の場合のみ実行）`);
    try {
      // まず「フルアウト」テキストのlist-menu-itemが直接見えるか確認（位置依存なし）
      const fulloutCheck = page.locator('[data-testid="list-menu-item"]').filter({ hasText: 'フルアウト' }).first();
      const fulloutAlreadyVisible = await fulloutCheck.isVisible({ timeout: 3000 }).catch(() => false);

      if (!fulloutAlreadyVisible) {
        // フルアウトが見えない → ワークスペース選択の前工程が必要
        const firstListItem = page.locator('[data-testid="list-menu-item"]').first();
        if (await firstListItem.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log(`  - ワークスペース選択画面を検知。前工程を実行します。`);
          // 録画6.json step6/7: div[2]/div/div[1] を2回クリック
          const clickTarget = firstListItem.locator('xpath=div[2]/div/div[1]');
          await clickTarget.click({ timeout: 3000 }).catch(() => firstListItem.click());
          await page.waitForTimeout(500);
          await clickTarget.click({ timeout: 3000 }).catch(() => firstListItem.click());
          await page.waitForTimeout(1500);
          // 録画6.json step8: Radixポップオーバーから選択 → navigation発生
          await page.locator('xpath=//*[contains(@id,"radix-")]/div/div[2]/div[1]/div[2]/div')
            .first().click({ timeout: 5000 });
          await page.waitForLoadState('load');
          await page.waitForTimeout(3000);
          console.log(`  => ✅ 前工程完了. URL: ${page.url()}`);
        } else {
          console.log(`  => ⚠️ 前工程対象画面なし（スキップ）`);
        }
      } else {
        console.log(`  => フルアウト直接表示。前工程スキップ`);
      }
    } catch(e) {
      console.log(`  => ⚠️ 前工程スキップ: ${e.message}`);
    }

    console.log(`\n[Step 1.3] チーム「フルアウト」を選択します。`);
    try {
      // テキスト「フルアウト」で特定 → 位置に依存しない
      const fulloutItem = page.locator('[data-testid="list-menu-item"]').filter({ hasText: 'フルアウト' }).first();
      if (await fulloutItem.isVisible({ timeout: 10000 }).catch(() => false)) {
        // SVGクリック（録画6.json step9）、失敗時はアイテム自体をクリック
        await fulloutItem.locator('xpath=div[1]/div/svg').click({ timeout: 3000 })
          .catch(() => fulloutItem.click());
        console.log(`  => ✅ フルアウト選択完了`);
        await page.waitForTimeout(5000);
        await page.waitForLoadState('load');
      } else {
        console.log(`  => ⚠️ フルアウト選択画面なし（スキップ）`);
      }
    } catch(e) {
      console.log(`  => ⚠️ フルアウト選択スキップ: ${e.message}`);
    }

    console.log(`\n[Step 1.4] UIデザインの確認を行います。`);
    const newDesignBtn = page.locator('div, button').filter({ hasText: '新デザインを試す' }).last();
    if (await newDesignBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`  => 🎨 旧デザインを検知。新デザインに切り替えます。`);
      await newDesignBtn.click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(5000);
    }

    // =========================================================
    // [Step 2] コピー元フォルダへ移動（検索パネルを開いて検索）
    // =========================================================
    console.log(`\n[Step 2] コピー元フォルダ「${sourceFolder}」へ移動します。`);
    await page.goto('https://app.squadbeyond.com/folders');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // チーム未選択でリダイレクトされた場合のリカバリー
    if (!page.url().includes('/folders')) {
      console.log(`  => ⚠️ /folders 遷移失敗。現在URL: ${page.url()} → チーム選択を再試行します。`);
      const fulloutRetry = page.locator('div').filter({ hasText: /^フルアウト$/ }).last();
      if (await fulloutRetry.isVisible({ timeout: 5000 }).catch(() => false)) {
        await fulloutRetry.click();
        await page.waitForTimeout(3000);
        await page.waitForLoadState('load');
      }
      await page.goto('https://app.squadbeyond.com/folders');
      await page.waitForLoadState('load');
      await page.waitForTimeout(2000);
    }

    console.log(`  - 「検索」をクリックして検索ポップアップを開きます。`);
    const searchTrigger1 = page.locator('input[placeholder*="検索"], [placeholder*="検索"]').first();
    if (await searchTrigger1.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchTrigger1.click();
    } else {
        await page.getByText('検索', { exact: true }).first().click();
    }
    await page.waitForTimeout(1500);

    console.log(`  - コピー元フォルダ名を入力します。`);
    const sideMenuInput = page.locator('div[role="dialog"] input').first().or(page.locator('input').last());
    await sideMenuInput.waitFor({ state: 'visible', timeout: 10000 });
    await sideMenuInput.fill(sourceFolder);
    await page.waitForTimeout(2000); 

    const folderTab2 = page.locator('span').filter({ hasText: /^フォルダ/ }).last();
    await folderTab2.waitFor({ state: 'visible', timeout: 10000 });
    await folderTab2.click();
    await page.waitForTimeout(1000);

    console.log(`  - 検索結果から「${sourceFolder}」をクリックします。`);
    const markResult = page.locator('[data-testid="list-menu-item"] mark').first();
    await markResult.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log(`  => 📄 新しいタブが開くのを待機します...`);
    const [newPageSource] = await Promise.all([
      context.waitForEvent('page'),
      markResult.click()
    ]);
    page = newPageSource;
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 3] 記事検索（フォルダ内検索）
    // =========================================================
    console.log(`\n[Step 3] 新しいタブのフォルダ内で記事「${sourceArticle}」を検索します。`);

    const folderSearchInput = page.locator('input[placeholder*="フォルダ内検索"], input[placeholder*="検索"]').last();
    if (!(await folderSearchInput.isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.locator('button.efy50tl0').click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await folderSearchInput.waitFor({ state: 'visible', timeout: 10000 });
    await folderSearchInput.fill(sourceArticle);
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 4] option-icon → 「別フォルダへ複製」
    // =========================================================
    console.log(`\n[Step 4] 対象記事のメニューを開きます。`);

    const articleItem = page.getByText(sourceArticle, { exact: true }).first();
    await articleItem.waitFor({ state: 'visible', timeout: 10000 });
    await articleItem.hover();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="option-icon"]').first().click();
    await page.waitForTimeout(1000);

    console.log(`  => 「別フォルダへ複製」を選択します。`);
    const duplicateMenuItem = page.getByText('別フォルダへ複製', { exact: true }).last();
    await duplicateMenuItem.waitFor({ state: 'visible', timeout: 10000 });
    await duplicateMenuItem.click();
    await page.waitForTimeout(2000);

    // =========================================================
    // [Step 5] 複製設定ダイアログ
    // =========================================================
    console.log(`\n[Step 5] 複製ウィザードを進めます。`);

    const activeModal = page.locator('div[role="dialog"]').last();

    console.log(`  - 1. チームを「現在のチーム内」に設定します。`);
    await activeModal.locator('section:nth-of-type(1) div.css-18ji2p4 > div').click();
    await page.waitForTimeout(500);
    await page.getByText('現在のチーム内', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    console.log(`  - 2. 複製先フォルダを選択します。`);
    await activeModal.locator('section:nth-of-type(2) div.css-18ji2p4 > div').click();
    await page.waitForTimeout(1000); 

    console.log(`  - 検索窓に「${destFolder}」を入力します。`);
    const destFolderSearchInput = page.locator('input').last();
    await destFolderSearchInput.waitFor({ state: 'visible', timeout: 5000 });
    await destFolderSearchInput.fill(destFolder);
    await page.waitForTimeout(2000);

    console.log(`  - グループ「${groupListDest}」をクリックして展開します。`);
    await page.getByText(groupListDest, { exact: true }).last().click();
    await page.waitForTimeout(1000);

    console.log(`  - フォルダ「${destFolder}」をクリックします。`);
    await page.locator('[data-testid="list-menu-item"]')
      .filter({ hasText: destFolder }).last()
      .locator('xpath=div[2]').click();
    await page.waitForTimeout(1000);

    console.log(`  - 3. 「⚠️後から変更できません」をクリックしてURLタブを開きます。`);
    await page.getByText('⚠️後から変更できません').click();
    await page.waitForTimeout(500);

    if (deliveryUrl) {
      console.log(`  - 配信URL「${deliveryUrl}」を入力します。`);
      const urlInput = activeModal.locator('section:nth-of-type(3) input').first();
      await urlInput.waitFor({ state: 'visible', timeout: 5000 });
      await urlInput.click();
      await urlInput.fill(deliveryUrl);
      await page.keyboard.press('Tab'); 
      await page.waitForTimeout(500);
    }

    console.log(`  - 「🙆いつでも変更可能です」をクリックしてページ名欄を開きます。`);
    const pageNameTab = page.getByText('いつでも変更可能です').last();
    await pageNameTab.waitFor({ state: 'visible', timeout: 5000 });
    await pageNameTab.click();
    await page.waitForTimeout(1000);

    console.log(`  - ページ名「${newArticleName}」を入力します。`);
    const pageNameInput = activeModal.locator('section:nth-of-type(3) input').last();
    await pageNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await pageNameInput.click();
    await page.keyboard.press('Control+A');
    await pageNameInput.fill(newArticleName);
    await page.waitForTimeout(500);

    console.log(`  - 「設定確認」をクリックします。`);
    await page.getByText('設定確認', { exact: true }).last().click();
    await page.waitForTimeout(2000);

    console.log(`  - 「この内容でページを複製する」をクリックします。`);
    await page.getByText('この内容でページを複製する', { exact: true }).last().click();

    // =========================================================
    // [Step 6] 複製完了待機 → destFolder検索 → URL取得
    // =========================================================
    console.log(`  => ⏳ 複製処理の完了を待機しています... (10秒)`);
    await page.waitForTimeout(10000);

    console.log(`\n[Step 6] 複製されたページのURLを取得します。`);

    await page.goto('https://app.squadbeyond.com/folders');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // チーム未選択でリダイレクトされた場合のリカバリー
    if (!page.url().includes('/folders')) {
      console.log(`  => ⚠️ /folders 遷移失敗。現在URL: ${page.url()} → チーム選択を再試行します。`);
      const fulloutRetry6 = page.locator('div').filter({ hasText: /^フルアウト$/ }).last();
      if (await fulloutRetry6.isVisible({ timeout: 5000 }).catch(() => false)) {
        await fulloutRetry6.click();
        await page.waitForTimeout(3000);
        await page.waitForLoadState('load');
      }
      await page.goto('https://app.squadbeyond.com/folders');
      await page.waitForLoadState('load');
      await page.waitForTimeout(2000);
    }

    console.log(`  - 複製先フォルダ「${destFolder}」を検索します。`);
    const searchTrigger2 = page.locator('input[placeholder*="検索"], [placeholder*="検索"]').first();
    if (await searchTrigger2.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchTrigger2.click();
    } else {
        await page.getByText('検索', { exact: true }).first().click();
    }
    await page.waitForTimeout(1500);

    const sideInputForUrl = page.locator('div[role="dialog"] input').first().or(page.locator('input').last());
    await sideInputForUrl.waitFor({ state: 'visible', timeout: 10000 });
    await sideInputForUrl.fill(destFolder);
    await page.waitForTimeout(2000);

    const folderTab6 = page.locator('span').filter({ hasText: /^フォルダ/ }).last();
    await folderTab6.waitFor({ state: 'visible', timeout: 10000 });
    await folderTab6.click();
    await page.waitForTimeout(1000);

    console.log(`  - フォルダ「${destFolder}」をクリックします。`);
    const markForUrl = page.locator('[data-testid="list-menu-item"] mark').first();
    await markForUrl.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log(`  => 📄 新しいタブが開くのを待機します...`);
    const [newPageDest] = await Promise.all([
      context.waitForEvent('page'),
      markForUrl.click()
    ]);
    page = newPageDest;
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    console.log(`  - コンテンツ内で記事「${newArticleName}」を検索します。`);
    const folderSearchInput2 = page.locator('input[placeholder*="フォルダ内検索"], input[placeholder*="検索"]').last();
    if (!(await folderSearchInput2.isVisible({ timeout: 2000 }).catch(() => false))) {
        await page.locator('button.efy50tl0').click().catch(() => {});
        await page.waitForTimeout(500);
    }
    await folderSearchInput2.waitFor({ state: 'visible', timeout: 10000 });
    await folderSearchInput2.fill(newArticleName);
    await page.waitForTimeout(3000);

    console.log(`  - 記事「${newArticleName}」をクリックして右サイドバーを開きます。`);
    const targetArticleRow = page.locator('[data-testid="list-menu-item"]')
      .filter({ hasText: newArticleName }).first();
    await targetArticleRow.waitFor({ state: 'visible', timeout: 10000 });
    await targetArticleRow.getByText(newArticleName, { exact: true }).first().click();
    await page.waitForTimeout(1500);

    console.log(`  - URLコピーボタンをクリックします。`);
    await page.getByRole('button', { name: 'コピー' }).first().click();
    await page.waitForTimeout(500);

    const finalUrl = await page.evaluate(() => navigator.clipboard.readText());
    console.log(`  => 🎉 取得したURL: ${finalUrl}`);

    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: finalUrl, status: 'success', task_type: 'duplicate' });
    }

    console.log(`\n🎉 RPA処理が完了しました！`);

  } catch (error) {
    console.error(`\n❌ エラー発生:\n`, error);
    await page.screenshot({ path: 'duplicate-error-screenshot.png', fullPage: true });

    console.log('\n========== DOM診断ログ ==========');
    console.log('[現在URL]', page.url());
    const diagTargets = [
      { label: 'side-menu',        sel: '[data-testid="side-menu"]' },
      { label: 'list-menu-item',   sel: '[data-testid="list-menu-item"]' },
      { label: 'option-icon',      sel: '[data-testid="option-icon"]' },
      { label: 'dialog',           sel: 'div[role="dialog"]' },
      { label: 'mark(検索結果)',    sel: 'mark' },
      { label: 'input(検索)',       sel: 'input[placeholder*="検索"]' },
    ];
    for (const t of diagTargets) {
      try {
        const count = await page.locator(t.sel).count();
        if (count > 0) {
          const html = await page.locator(t.sel).first().innerHTML();
          console.log(`[${t.label}] count=${count} HTML(先頭500字):\n${html.slice(0, 500)}\n`);
        } else {
          console.log(`[${t.label}] 見つかりません`);
        }
      } catch(e) { console.log(`[${t.label}] 取得失敗: ${e.message}`); }
    }
    console.log('==================================\n');

    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: "", status: 'error', task_type: 'duplicate' });
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
