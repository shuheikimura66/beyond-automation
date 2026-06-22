const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1372, height: 841 },
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();

  // =========================================================
  // 1. 変数の設定
  // =========================================================
  const rowIdx          = process.env.ROW_IDX;
  const groupListSource = process.env.GROUP_LIST_NAME_SOURCE; // 受け取るが直接使わない
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
    // [Step 1] ログイン
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
      await page.getByText('ログアウト', { exact: true }).last().click();
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
      await page.locator('div').filter({ hasText: /^フルアウト$/ }).last().click();
      console.log(`  => ✅ フルアウト選択完了`);
      await page.waitForTimeout(5000);
      await page.waitForLoadState('load');
    } catch(e) {
      console.log(`  => ⚠️ フルアウト選択スキップ（自動遷移した可能性があります）`);
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
    // [Step 2] コピー元フォルダへ移動（録画 0607_10.json ベース）
    // 検索パネルを開いてsourceFolderを検索 → クリック
    // =========================================================
    console.log(`\n[Step 2] コピー元フォルダ「${sourceFolder}」へ移動します。`);
    await page.goto('https://app.squadbeyond.com/folders');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // 「検索」スパンをクリックして検索ダイアログを開く
    console.log(`  - 「検索」をクリックして検索ダイアログを開きます。`);
    await page.getByText('検索', { exact: true }).first().click();
    await page.waitForTimeout(800);

    // inputに入力（ダイアログが開いてから）
    const sideMenuInput = page.locator('input[placeholder*="検索"]').first();
    await sideMenuInput.waitFor({ state: 'visible', timeout: 10000 });
    await sideMenuInput.fill(sourceFolder);
    await page.waitForTimeout(1500); // 検索結果が出るまで待つ

    // 「フォルダ」タブ：ダイアログスコープ内で待ってからクリック（ページ内のフォルダ名と混同しないため）
    const searchDialog2 = page.locator('div[role="dialog"]').first();
    const folderTab2 = searchDialog2.getByText('フォルダ', { exact: true });
    await folderTab2.waitFor({ state: 'visible', timeout: 10000 });
    await folderTab2.click();
    await page.waitForTimeout(1000);

    // 検索結果のmark要素をクリックしてフォルダへ移動
    console.log(`  - 検索結果から「${sourceFolder}」をクリックします。`);
    const markResult = page.locator('mark').filter({ hasText: sourceFolder }).first();
    await markResult.waitFor({ state: 'visible', timeout: 10000 });
    await markResult.click();
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 3] 記事検索（task.js と同じセレクター）
    // =========================================================
    console.log(`\n[Step 3] フォルダ内で記事「${sourceArticle}」を検索します。`);

    await page.locator('button.efy50tl0').click();
    await page.waitForTimeout(500);
    await page.locator('div.css-68s747 input').first().fill(sourceArticle);
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 4] option-icon → 「別フォルダへ複製」
    // 新UI: 3ドットメニューから「別フォルダへ複製」を選択
    // =========================================================
    console.log(`\n[Step 4] 対象記事のメニューを開きます。`);

    // 記事行にhoverしてoption-iconを出現させてからクリック
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
    // [Step 5] 複製設定ダイアログ（録画 0607_10.json ベース）
    // =========================================================
    console.log(`\n[Step 5] 複製ウィザードを進めます。`);

    const activeModal = page.locator('div[role="dialog"]').last();

    // --- チーム選択（section 1） ---
    console.log(`  - 1. チームを「現在のチーム内」に設定します。`);
    await activeModal.locator('section:nth-of-type(1) div.css-18ji2p4 > div').click();
    await page.waitForTimeout(500);
    await page.getByText('現在のチーム内', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    // --- フォルダ選択（section 2） ---
    console.log(`  - 2. 複製先フォルダを選択します。`);
    await activeModal.locator('section:nth-of-type(2) div.css-18ji2p4 > div').click();
    await page.waitForTimeout(500);

    // destFolderで検索
    console.log(`  - 検索窓に「${destFolder}」を入力します。`);
    await page.locator('div:nth-of-type(10) input').fill(destFolder);
    await page.waitForTimeout(2000);

    // groupListDestクリック（div[2] = テキスト部分 → グループを展開）
    console.log(`  - グループ「${groupListDest}」をクリックして展開します。`);
    await page.getByText(groupListDest, { exact: true }).last().click();
    await page.waitForTimeout(1000);

    // destFolderクリック（録画 1.json: div[2] = 直接子の2番目div = テキスト部分）
    // ※ CSS div:nth-of-type(2) はサブツリー全体にマッチして strict mode violation を起こすため
    //   XPath div[2]（直接の子のみ）を使用する
    console.log(`  - フォルダ「${destFolder}」をクリックします。`);
    await page.locator('[data-testid="list-menu-item"]')
      .filter({ hasText: destFolder }).last()
      .locator('xpath=div[2]').click();
    await page.waitForTimeout(1000);

    // --- 配信URLタブを開く ---
    // 録画 1.json: タブ trigger の span（text: ⚠️後から変更できません）をクリックして展開
    // ※ 「配信URL」テキストではなく ⚠️スパンがRadix UIのaccordion trigger
    console.log(`  - 3. 「⚠️後から変更できません」をクリックしてURLタブを開きます。`);
    await page.getByText('⚠️後から変更できません').click();
    await page.waitForTimeout(500);

    if (deliveryUrl) {
      console.log(`  - 配信URL「${deliveryUrl}」を入力します。`);
      const urlInput = activeModal.locator('section:nth-of-type(3) input').first();
      await urlInput.waitFor({ state: 'visible', timeout: 5000 });
      await urlInput.click();
      await urlInput.fill(deliveryUrl);
      await page.keyboard.press('Tab'); // blur してバリデーション確定
      await page.waitForTimeout(500);
    }

    // --- ページ名タブを開く（録画: text/🙆いつでも変更可能です）---
    console.log(`  - 「🙆いつでも変更可能です」をクリックしてページ名欄を開きます。`);
    const pageNameTab = page.getByText('いつでも変更可能です').last();
    await pageNameTab.waitFor({ state: 'visible', timeout: 5000 });
    await pageNameTab.click();
    await page.waitForTimeout(1000);

    // --- ページ名入力（タブを開いた後の input） ---
    console.log(`  - ページ名「${newArticleName}」を入力します。`);
    const pageNameInput = activeModal.locator('section:nth-of-type(3) input').last();
    await pageNameInput.waitFor({ state: 'visible', timeout: 5000 });
    await pageNameInput.click();
    await page.keyboard.press('Control+A');
    await pageNameInput.fill(newArticleName);
    await page.waitForTimeout(500);

    // --- 設定確認（録画 1.json 確認済み: beyondページ複製でも必要）---
    console.log(`  - 「設定確認」をクリックします。`);
    await page.getByText('設定確認', { exact: true }).last().click();
    await page.waitForTimeout(2000);

    // --- 複製実行 ---
    console.log(`  - 「この内容でページを複製する」をクリックします。`);
    await page.getByText('この内容でページを複製する', { exact: true }).last().click();

    // =========================================================
    // [Step 6] 複製完了待機 → destFolder検索 → 記事名検索 → hover → 編集ボタン → URL取得
    // フロー: /folders → サイドメニューdestFolder検索・クリック
    //         → コンテンツ内newArticleName検索 → hover → 右の編集ボタンクリック
    //         → コピーボタン → clipboard取得
    // =========================================================
    console.log(`  => ⏳ 複製処理の完了を待機しています... (10秒)`);
    await page.waitForTimeout(10000);

    console.log(`\n[Step 6] 複製されたページのURLを取得します。`);

    // /folders へ移動
    await page.goto('https://app.squadbeyond.com/folders');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // 「検索」スパンをクリックして検索ダイアログを開く
    console.log(`  - 複製先フォルダ「${destFolder}」を検索します。`);
    await page.getByText('検索', { exact: true }).first().click();
    await page.waitForTimeout(800);

    const sideInputForUrl = page.locator('input[placeholder*="検索"]').first();
    await sideInputForUrl.waitFor({ state: 'visible', timeout: 10000 });
    await sideInputForUrl.fill(destFolder);
    await page.waitForTimeout(1500); // 検索結果が出るまで待つ

    // 「フォルダ」タブ：ダイアログスコープ内で待ってからクリック
    const searchDialog6 = page.locator('div[role="dialog"]').first();
    const folderTab6 = searchDialog6.getByText('フォルダ', { exact: true });
    await folderTab6.waitFor({ state: 'visible', timeout: 10000 });
    await folderTab6.click();
    await page.waitForTimeout(1000);

    // 検索結果のmark要素をクリックしてフォルダへ移動
    console.log(`  - フォルダ「${destFolder}」をクリックします。`);
    await page.locator('mark').filter({ hasText: destFolder }).first().click();
    await page.waitForTimeout(3000);

    // コンテンツエリアの検索ボタンで記事名を検索（Step 3 と同じセレクター）
    console.log(`  - コンテンツ内で記事「${newArticleName}」を検索します。`);
    await page.locator('button.efy50tl0').click();
    await page.waitForTimeout(500);
    await page.locator('div.css-68s747 input').first().fill(newArticleName);
    await page.waitForTimeout(3000);

    // 記事名をクリック → 右サイドバーが開く
    console.log(`  - 記事「${newArticleName}」をクリックして右サイドバーを開きます。`);
    const targetArticleRow = page.locator('[data-testid="list-menu-item"]')
      .filter({ hasText: newArticleName }).first();
    await targetArticleRow.waitFor({ state: 'visible', timeout: 10000 });
    await targetArticleRow.getByText(newArticleName, { exact: true }).first().click();
    await page.waitForTimeout(1500);

    // URLコピーボタンをクリック
    console.log(`  - URLコピーボタンをクリックします。`);
    await page.getByRole('button', { name: 'コピー' }).first().click();
    await page.waitForTimeout(500);

    // クリップボードからURL取得
    const finalUrl = await page.evaluate(() => navigator.clipboard.readText());
    console.log(`  => 🎉 取得したURL: ${finalUrl}`);

    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: finalUrl, status: 'success', task_type: 'duplicate' });
    }

    console.log(`\n🎉 RPA処理が完了しました！`);

  } catch (error) {
    console.error(`\n❌ エラー発生:\n`, error);
    await page.screenshot({ path: 'duplicate-error-screenshot.png', fullPage: true });

    // DOM診断：UIが変わったときのセレクター特定用
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
