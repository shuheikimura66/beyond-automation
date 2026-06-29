const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1372, height: 841 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  let page = await context.newPage();

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

    // =========================================================
    // [Step 1] ログイン処理
    // =========================================================
    console.log(`\n[Step 1] ターゲットURLにアクセスします: ${targetUrl}`);
    await page.goto(targetUrl);
    
    try {
        await page.waitForSelector('input[name="email"], input[type="email"], [data-testid="list-menu-item"]', { timeout: 15000 });
    } catch(e) {}

    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    const passInput = page.locator('input[name="password"], input[type="password"]').first();

    if (await emailInput.isVisible().catch(() => false)) {
      console.log(`  => 🔑 ログイン画面を検知。人間らしい速度で入力します。`);
      await emailInput.click();
      await emailInput.clear();
      await emailInput.pressSequentially(process.env.SQUADBEYOND_ID, { delay: 50 });
      await page.waitForTimeout(500);

      await passInput.click();
      await passInput.clear();
      await passInput.pressSequentially(process.env.SQUADBEYOND_PASS, { delay: 50 });
      await page.waitForTimeout(1000);

      console.log(`  => ⏳ ログインボタンをクリックして遷移を待機します...`);
      await page.getByRole('button', { name: 'ログイン' }).first().click();

      try {
        await Promise.race([
            page.waitForURL('**/users/teams', { timeout: 20000 }),
            page.waitForSelector('[data-testid="list-menu-item"]', { timeout: 20000 })
        ]);
        console.log(`  => ✅ ログイン通信完了 (URL: ${page.url()})`);
      } catch (e) {
        console.log(`  => ⚠️ 遷移タイムアウト。無限ロードの可能性があります。`);
      }
      await page.waitForTimeout(2000);
    }

    console.log(`\n[Step 1.1] 状態リセット（強制ログアウトまたはリロード）`);
    await page.goto(targetUrl);
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    try {
      const profileIcon = page.locator('div').filter({ hasText: /^小$/ }).last();
      if (await profileIcon.isVisible().catch(() => false)) {
        await profileIcon.click();
        await page.waitForTimeout(1000);
        await page.getByText('ログアウト', { exact: true }).last().click();
        console.log(`  => ✅ ログアウト完了`);
        await page.waitForLoadState('load');
        await page.waitForTimeout(3000);
      }
    } catch(e) {
      console.log(`  => ⚠️ ログアウトスキップ（すでにログアウト済み等）`);
    }

    console.log(`\n[Step 1.2] クリーンな状態で再度ログインを実行します。`);
    try {
        await page.waitForSelector('input[name="email"], input[type="email"], [data-testid="list-menu-item"]', { timeout: 10000 });
    } catch(e) {}

    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.click();
      await emailInput.clear();
      await emailInput.pressSequentially(process.env.SQUADBEYOND_ID, { delay: 50 });
      await page.waitForTimeout(500);

      await passInput.click();
      await passInput.clear();
      await passInput.pressSequentially(process.env.SQUADBEYOND_PASS, { delay: 50 });
      await page.waitForTimeout(1000);

      console.log(`  => ⏳ ログインボタンをクリックして遷移を待機します...`);
      await page.getByRole('button', { name: 'ログイン' }).first().click();

      try {
        await Promise.race([
            page.waitForURL('**/users/teams', { timeout: 20000 }),
            page.waitForSelector('[data-testid="list-menu-item"]', { timeout: 20000 })
        ]);
      } catch (e) {
        console.log(`  => ⚠️ 再ログイン遷移タイムアウト`);
      }
      await page.waitForTimeout(2000);
    }

    // =========================================================
    // [Step 1.3] チーム「フルアウト」を選択
    // =========================================================
    console.log(`\n[Step 1.3] チーム「フルアウト」を選択します。`);
    try {
      const fulloutItem = page.locator('div, [data-testid="list-menu-item"]').filter({ hasText: /^フルアウト$/ }).first();
      if (await fulloutItem.isVisible({ timeout: 10000 }).catch(() => false)) {
        await fulloutItem.click();
        console.log(`  => ✅ フルアウト選択完了`);
        
        await page.waitForURL('https://app.squadbeyond.com/', { timeout: 10000 }).catch(() => {});
        await page.waitForLoadState('load');
        await page.waitForTimeout(3000);
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

    console.log(`\n[Step 1.5] 「ページ」メニューをクリックします。`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('[data-testid="list-menu-item"]').nth(2).waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('[data-testid="list-menu-item"]').nth(2).click();
    await page.waitForTimeout(3000);
    await page.waitForLoadState('load');

    // =========================================================
    // [Step 2] フォルダ作成
    // =========================================================
    console.log(`\n[Step 2] コピー先のフォルダを新規作成します（新UIフロー）。`);
    console.log(`  - フォルダ作成アイコンをクリックします。`);
    await page.locator('[data-testid="generate-folder-icon"]').click();
    await page.waitForTimeout(1000);

    console.log(`  - 「フォルダ作成...」をクリックします。`);
    await page.getByText('フォルダ作成...', { exact: true }).click();
    await page.waitForTimeout(1000);

    console.log(`  - 「独自ドメイン」を選択します。`);
    await page.getByText('独自ドメイン', { exact: true }).click();
    await page.waitForTimeout(1500); 

    const domainCombobox = page.getByRole('combobox').filter({ hasText: '独自ドメインを選択する' });
    await domainCombobox.waitFor({ state: 'visible' });
    await domainCombobox.click();
    await page.waitForTimeout(500);

    console.log(`  - ドメイン「${domain}」を入力します。`);
    await page.locator('input').last().fill(domain);
    await page.waitForTimeout(1000);
    await page.getByText(domain).last().click();
    await page.waitForTimeout(1000);

    console.log(`  - グループ選択を開きます。`);
    await page.locator('div.css-1vn620w').click();
    await page.waitForTimeout(1000);

    console.log(`  - グループ「${groupListDest}」を入力して選択します。`);
    const groupInput = page.locator('input').last();
    await groupInput.waitFor({ state: 'visible', timeout: 5000 });
    await groupInput.fill(groupListDest);
    await page.waitForTimeout(1000);
    await page.getByText(groupListDest).last().click();
    await page.waitForTimeout(500);

    await page.getByText('設定確認', { exact: true }).click();
    await page.waitForTimeout(1000);

    console.log(`  - 「作成する」をクリックしてフォルダを作成します。`);
    await page.locator('div.css-1wtvhju').getByText('作成する', { exact: true }).click();
    console.log(`  => ⏳ フォルダ作成中...`);
    await page.waitForTimeout(5000);

    // =========================================================
    // [Step 2.5] フォルダ名称変更
    // =========================================================
    console.log(`\n[Step 2.5] 作成したフォルダを「${destFolder}」に名称変更します。`);
    await page.locator('div[role="dialog"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    console.log(`  - /folders に移動してページ一覧ビューに戻ります。`);
    await page.goto('https://app.squadbeyond.com/folders');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    console.log(`  - 「検索」をクリックして検索パネルを開きます。`);
    const searchTrigger1 = page.locator('input[placeholder*="検索"], [placeholder*="検索"]').first();
    if (await searchTrigger1.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchTrigger1.click();
    } else {
        await page.getByText('検索', { exact: true }).first().click();
    }
    await page.waitForTimeout(1500);

    console.log(`  - 「新しいフォルダ」を検索します。`);
    const sideMenuInput = page.locator('div[role="dialog"] input').first().or(page.locator('input').last());
    await sideMenuInput.waitFor({ state: 'visible', timeout: 10000 });
    await sideMenuInput.fill('新しいフォルダ');
    await page.waitForTimeout(2000);

    await page.locator('span').filter({ hasText: /^フォルダ/ }).last().click();
    await page.waitForTimeout(1000);

    console.log(`  - 検索結果の「新しいフォルダ」をクリックし、新タブ遷移を待機します。`);
    const newFolderMark = page.locator('mark').filter({ hasText: '新しいフォルダ' }).first();
    await newFolderMark.waitFor({ state: 'visible', timeout: 10000 });
    
    const [newPageRename] = await Promise.all([
      context.waitForEvent('page'),
      newFolderMark.click()
    ]);
    page = newPageRename; 
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    console.log(`  - 新タブのサイドバーで「新しいフォルダ」をホバーし、名称変更メニューを開きます。`);
    const targetNewFolder = page.locator('[data-testid="list-menu-item"]:visible').filter({ hasText: /^新しいフォルダ$/ }).first();
    await targetNewFolder.waitFor({ state: 'visible', timeout: 10000 });
    await targetNewFolder.hover();
    await page.waitForTimeout(500);

    console.log(`  - 3ドットメニューをクリックします。`);
    try {
        await targetNewFolder.locator('button:has(svg), [data-testid="option-icon"]').last().click({ timeout: 3000 });
    } catch(e) {
        await targetNewFolder.locator('svg').last().click();
    }
    await page.waitForTimeout(500);

    console.log(`  - 「名称変更」をクリックします。`);
    await page.getByText('名称変更', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    console.log(`  - オートフォーカスを利用して直接フォルダ名を入力します。`);
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Meta+A'); 
    await page.keyboard.press('Backspace');
    await page.keyboard.type(destFolder, { delay: 50 });
    await page.waitForTimeout(500);
    
    console.log(`  - 画面右側をクリックして名称変更を確定させます。`);
    await page.mouse.click(1200, 400); // 画面右側の安全なエリアをクリック
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 3] コピー元フォルダを検索パネルで直接検索してクリック
    // =========================================================
    console.log(`\n[Step 3] 原本フォルダ「${sourceFolder}」を検索します。`);

    const searchTrigger2 = page.locator('input[placeholder*="検索"], [placeholder*="検索"]').first();
    if (await searchTrigger2.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchTrigger2.click();
    } else {
        await page.getByText('検索', { exact: true }).first().click().catch(() => {});
    }
    await page.waitForTimeout(1500);

    console.log(`  - 「${sourceFolder}」を検索してクリックします。`);
    const sideMenuInput3 = page.locator('div[role="dialog"] input').first().or(page.locator('input').last());
    await sideMenuInput3.waitFor({ state: 'visible', timeout: 10000 });
    await sideMenuInput3.fill(sourceFolder);
    await page.waitForTimeout(2000);

    await page.locator('span').filter({ hasText: /^フォルダ/ }).last().click();
    await page.waitForTimeout(1000);

    const sourceFolderMark = page.locator('mark').filter({ hasText: sourceFolder }).first();
    await sourceFolderMark.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log(`  => 📄 さらなる新タブが開くのを待機します...`);
    const [newPageSource] = await Promise.all([
      context.waitForEvent('page'),
      sourceFolderMark.click()
    ]);
    page = newPageSource;
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 4] 記事検索
    // =========================================================
    console.log(`\n[Step 4] 新しいタブのフォルダ内で記事「${sourceArticle}」を検索します。`);

    const folderSearchInput = page.locator('input[placeholder*="フォルダ内検索"], input[placeholder*="検索"]').last();
    if (!(await folderSearchInput.isVisible({ timeout: 2000 }).catch(() => false))) {
        await page.locator('button.efy50tl0').click().catch(() => {});
        await page.waitForTimeout(500);
    }
    await folderSearchInput.waitFor({ state: 'visible', timeout: 10000 });
    await folderSearchInput.fill(sourceArticle);
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 5] 「別フォルダへ複製」を選択
    // =========================================================
    console.log(`\n[Step 5] 「別フォルダへ複製」を選択します。`);

    // ★大修正: 意図せぬポップアップや残ったモーダルを消すために画面右側をクリック
    console.log(`  - 意図せぬポップアップを解除するため、画面右側をクリックします。`);
    await page.mouse.click(1200, 400); // 画面幅1372の中の右端エリアをターゲット
    await page.waitForTimeout(500);

    const articleItem = page.getByText(sourceArticle).first();
    await articleItem.waitFor({ state: 'visible', timeout: 10000 });
    
    try {
        await articleItem.hover({ timeout: 5000 });
    } catch (e) {
        console.log(`  => ⚠️ ホバーが妨害されました。再度背景をクリックしてリトライします。`);
        await page.mouse.click(1200, 400);
        await page.waitForTimeout(500);
        await articleItem.hover();
    }
    await page.waitForTimeout(500);

    await page.locator('[data-testid="option-icon"]').first().click();
    await page.waitForTimeout(500);

    await page.getByText('別フォルダへ複製', { exact: true }).last().click();
    await page.waitForTimeout(2000);

    // =========================================================
    // [Step 6] 複製設定
    // =========================================================
    console.log(`\n[Step 6] 複製ウィザードを進めます（新UI対応）。`);

    const activeModal = page.locator('div[role="dialog"]').last();

    console.log(`  - 複製先チームを「現在のチーム内」に設定します。`);
    await activeModal.locator('section:nth-of-type(1) div.css-18ji2p4 > div').click();
    await page.waitForTimeout(500);
    await page.getByText('現在のチーム内', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    console.log(`  - 複製先フォルダを選択します。`);
    await activeModal.locator('section:nth-of-type(2) div.css-18ji2p4 > div').click();
    await page.waitForTimeout(1000);

    console.log(`  - 検索窓にフォルダ名を入力します。`);
    const destFolderSearchInput = page.locator('input').last();
    await destFolderSearchInput.waitFor({ state: 'visible', timeout: 5000 });
    await destFolderSearchInput.fill(destFolder);
    await page.waitForTimeout(2000);

    console.log(`  - グループ「${groupListDest}」をクリックして展開します。`);
    await page.getByText(groupListDest).last().click();
    await page.waitForTimeout(1000);

    await page.locator('[data-testid="list-menu-item"]:visible')
      .filter({ hasText: destFolder }).last()
      .locator('xpath=div[2]').click();
    await page.waitForTimeout(1000);

    if (deliveryUrl) {
      console.log(`  - 配信URLを入力します: ${deliveryUrl}`);
      const urlInput = activeModal.locator('section:nth-of-type(3) input').first();
      await urlInput.waitFor({ state: 'visible', timeout: 5000 });
      await urlInput.click();
      await urlInput.fill(deliveryUrl);
      await page.keyboard.press('Tab'); 
      await page.waitForTimeout(500);
    }

    const pageNameAccordion = page.getByText('いつでも変更可能です').last();
    if (await pageNameAccordion.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pageNameAccordion.click();
      await page.waitForTimeout(800);
    }

    await page.getByText('設定確認', { exact: true }).last().click();
    await page.waitForTimeout(2000);

    console.log(`  - 「この内容でページを複製する」をクリックします。`);
    await page.getByText('この内容でページを複製する', { exact: true }).last().click();

    console.log(`  => ⏳ 複製処理の完了を待機しています... (10秒)`);
    await page.waitForTimeout(10000);

    await page.screenshot({ path: 'final-check.png', fullPage: true });

    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: "", status: 'success' });
    }
    console.log(`\n🎉 RPA処理が完了しました！`);

  } catch (error) {
    console.error(`\n❌ エラー発生:\n`, error);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });

    console.log('\n========== DOM診断ログ ==========');
    console.log('[現在URL]', page.url());
    const diagTargets = [
      { label: 'side-menu',             sel: '[data-testid="side-menu"]' },
      { label: 'list-menu-item',        sel: '[data-testid="list-menu-item"]' },
      { label: 'generate-folder-icon',  sel: '[data-testid="generate-folder-icon"]' },
      { label: 'option-icon',           sel: '[data-testid="option-icon"]' },
      { label: 'dialog',                sel: 'div[role="dialog"]' },
      { label: 'combobox',              sel: '[role="combobox"]' },
      { label: 'mark(検索結果)',         sel: 'mark' },
      { label: 'input(検索)',            sel: 'input[placeholder*="検索"]' },
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
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: "", status: 'error' });
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
