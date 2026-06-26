const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1372, height: 841 }
  });
  // ★const から let に変更（後で新しいタブに上書きするため）
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
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    const emailInput = page.locator('input[name="email"]');

    if (await emailInput.isVisible().catch(() => false)) {
      console.log(`  => 🔑 ログイン画面を検知。一度ログインします。`);
      await emailInput.fill(process.env.SQUADBEYOND_ID);
      await page.waitForTimeout(500);
      await page.locator('input[name="password"]').fill(process.env.SQUADBEYOND_PASS);
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'ログイン' }).first().click();
      await page.waitForLoadState('load');
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
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(process.env.SQUADBEYOND_ID);
      await page.waitForTimeout(500);
      await page.locator('input[name="password"]').fill(process.env.SQUADBEYOND_PASS);
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'ログイン' }).first().click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(4000);
    }

    console.log(`\n[Step 1.3] チーム「フルアウト」を選択します。`);
    try {
      const fulloutDiv = page.locator('div').filter({ hasText: /^フルアウト$/ }).last();
      await fulloutDiv.click();
      console.log(`  => ✅ フルアウト選択完了`);
      await page.waitForTimeout(5000);
      await page.waitForLoadState('load');
    } catch(e) {
      console.log(`  => ⚠️ フルアウト選択スキップ（自動遷移した可能性があります）`);
    }

    console.log(`\n[Step 1.5] 「ページ」メニューをクリックします。`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('[data-testid="list-menu-item"]').nth(2).waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('[data-testid="list-menu-item"]').nth(2).click();
    await page.waitForTimeout(3000);
    await page.waitForLoadState('load');

    // =========================================================
    // [Step 2] フォルダ作成（新UIフロー）
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
    await page.getByText(domain, { exact: true }).last().click();
    await page.waitForTimeout(1000);

    console.log(`  - グループ選択を開きます。`);
    await page.locator('div.css-1vn620w').click();
    await page.waitForTimeout(1000);

    console.log(`  - グループ「${groupListDest}」を入力して選択します。`);
    const groupInput = page.locator('input').last();
    await groupInput.waitFor({ state: 'visible', timeout: 5000 });
    await groupInput.fill(groupListDest);
    await page.waitForTimeout(1000);
    await page.getByText(groupListDest, { exact: true }).last().click();
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

    // ★修正: 検索モーダル起動
    console.log(`  - 「検索」をクリックして検索パネルを開きます。`);
    const searchTrigger1 = page.locator('input[placeholder*="検索"], [placeholder*="検索"]').first();
    if (await searchTrigger1.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchTrigger1.click();
    } else {
        await page.getByText('検索', { exact: true }).first().click();
    }
    await page.waitForTimeout(1500);

    console.log(`  - 「新しいフォルダ」を検索します。`);
    // ★修正: モーダル内 input 取得
    const sideMenuInput = page.locator('div[role="dialog"] input').first().or(page.locator('input').last());
    await sideMenuInput.waitFor({ state: 'visible', timeout: 10000 });
    await sideMenuInput.fill('新しいフォルダ');
    await page.waitForTimeout(2000);

    await page.getByText(/^フォルダ/).last().click();
    await page.waitForTimeout(1000);

    const newFolderMark = page.locator('mark').filter({ hasText: '新しいフォルダ' }).first();
    await newFolderMark.waitFor({ state: 'visible', timeout: 10000 });
    await newFolderMark.hover();
    await page.waitForTimeout(500);

    console.log(`  - 3ドットボタンをクリックします。`);
    await page.locator('[data-testid="option-icon"]').first().click();
    await page.waitForTimeout(500);

    await page.getByText('名称変更', { exact: true }).click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+A');
    await page.keyboard.type(destFolder, { delay: 50 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.keyboard.press('Escape'); // モーダルが開いていれば閉じる

    // =========================================================
    // [Step 3] コピー元フォルダを検索パネルで直接検索してクリック
    // =========================================================
    console.log(`\n[Step 3] 原本フォルダ「${sourceFolder}」を検索します。`);

    // ★修正: 検索モーダル再起動（閉じている場合）
    const searchTrigger2 = page.locator('input[placeholder*="検索"], [placeholder*="検索"]').first();
    if (await searchTrigger2.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchTrigger2.click();
    } else {
        await page.getByText('検索', { exact: true }).first().click().catch(() => {});
    }
    await page.waitForTimeout(1500);

    console.log(`  - 「${sourceFolder}」を検索してクリックします。`);
    // ★修正: モーダル内 input 取得
    const sideMenuInput3 = page.locator('div[role="dialog"] input').first().or(page.locator('input').last());
    await sideMenuInput3.waitFor({ state: 'visible', timeout: 10000 });
    await sideMenuInput3.fill(sourceFolder);
    await page.waitForTimeout(2000);

    await page.getByText(/^フォルダ/).last().click();
    await page.waitForTimeout(1000);

    // ★修正: 新タブ遷移の捕捉
    const sourceFolderMark = page.locator('mark').filter({ hasText: sourceFolder }).first();
    await sourceFolderMark.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log(`  => 📄 新しいタブが開くのを待機します...`);
    const [newPageSource] = await Promise.all([
      context.waitForEvent('page'),
      sourceFolderMark.click()
    ]);
    page = newPageSource; // これ以降、RPAの操作対象を新しいタブに切り替える
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 4] 記事検索（新UIセレクター）
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

    const articleItem = page.getByText(sourceArticle, { exact: true }).first();
    await articleItem.waitFor({ state: 'visible', timeout: 10000 });
    await articleItem.hover();
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

    console.log(`  - 複製先フォルダ「${destFolder}」を選択します。`);
    await activeModal.locator('section:nth-of-type(2) div.css-18ji2p4 > div').click();
    await page.waitForTimeout(1000);

    console.log(`  - 検索窓にフォルダ名を入力します。`);
    // ★修正: nth-of-type(10) を廃止し、最後に展開された input を取得
    const destFolderSearchInput = page.locator('input').last();
    await destFolderSearchInput.waitFor({ state: 'visible', timeout: 5000 });
    await destFolderSearchInput.fill(destFolder);
    await page.waitForTimeout(2000);

    await page.getByText(groupListDest, { exact: true }).last().click();
    await page.waitForTimeout(1000);

    // ★修正: xpath=div[2] を使用して strict mode violation を防止
    await page.locator('[data-testid="list-menu-item"]')
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
