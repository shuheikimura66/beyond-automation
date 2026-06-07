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

    // 検索ボタンでパネルを開く
    console.log(`  - 検索ボタンをクリックしてパネルを開きます。`);
    await page.getByRole('button', { name: /^検索$/ }).first().click();
    await page.waitForTimeout(800);

    // XPath指定でinputを取得してsourceFolderを入力
    const sideMenuInput = page.locator('xpath=//*[@data-testid="side-menu"]/div[1]/div[1]/div/div/label/input');
    await sideMenuInput.waitFor({ state: 'visible', timeout: 5000 });
    await sideMenuInput.fill(sourceFolder);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // 検索結果からフォルダをクリック
    console.log(`  - 検索結果から「${sourceFolder}」をクリックします。`);
    await page.locator('[data-testid="list-menu-item"]')
      .filter({ hasText: sourceFolder }).first().click();
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
    // [Step 4] option-icon → 「beyondページ複製」
    // 録画より: 常に「beyondページ複製」（isSameFolder条件なし）
    // =========================================================
    console.log(`\n[Step 4] 対象記事のメニューを開きます。`);

    // 記事行にhoverしてoption-iconを出現させてからクリック
    const articleItem = page.getByText(sourceArticle, { exact: true }).first();
    await articleItem.waitFor({ state: 'visible', timeout: 10000 });
    await articleItem.hover();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="option-icon"]').first().click();
    await page.waitForTimeout(500);

    console.log(`  => 「beyondページ複製」を選択します。`);
    await page.getByText('beyondページ複製', { exact: true }).last().click();
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

    // destFolderクリック（録画 1.json: div[2] = テキスト部分）
    console.log(`  - フォルダ「${destFolder}」をクリックします。`);
    await page.locator('[data-testid="list-menu-item"]')
      .filter({ hasText: destFolder }).last()
      .locator('div:nth-of-type(2)').click();
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
    // [Step 6] 複製完了待機 → 複製記事を開いてURLをコピー取得 → GAS送信
    // 録画 2.json: destFolder検索 → クリック → 記事クリック → コピーボタン → clipboard取得
    // =========================================================
    console.log(`  => ⏳ 複製処理の完了を待機しています... (10秒)`);
    await page.waitForTimeout(10000);

    console.log(`\n[Step 6] 複製されたページのURLを取得します。`);

    // /folders へ移動
    await page.goto('https://app.squadbeyond.com/folders');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // 検索ボタンを必ずクリックしてパネルを開く（録画 3.json: aria/検索 button を常にクリック）
    console.log(`  - 検索パネルを開きます。`);
    await page.getByRole('button', { name: /^検索$/ }).first().click();
    await page.waitForTimeout(800);

    // destFolder を検索（録画: Enterなし = change eventのみ、waitで結果を待つ）
    console.log(`  - 複製先フォルダ「${destFolder}」を検索します。`);
    const sideInputForUrl = page.locator('xpath=//*[@data-testid="side-menu"]/div[1]/div[1]/div/div/label/input');
    await sideInputForUrl.waitFor({ state: 'visible', timeout: 5000 });
    await sideInputForUrl.fill(destFolder);
    await page.waitForTimeout(2000); // Enterなし：検索結果が自動で出るまで待つ

    // destFolder をクリック（div[2] = テキスト部分）
    await page.locator('[data-testid="list-menu-item"]')
      .filter({ hasText: destFolder }).first()
      .locator('div:nth-of-type(2)').click();
    await page.waitForTimeout(3000);

    // 記事をクリックして右パネルを開く
    // 録画 3.json: xpath/[data-testid="list-menu-item"]/div/div/div[2]/div[1]/div[1]
    console.log(`  - 記事をクリックして詳細パネルを開きます。`);
    const articleCell = page.locator('xpath=//*[@data-testid="list-menu-item"]/div/div/div[2]/div[1]/div[1]').first();
    await articleCell.waitFor({ state: 'visible', timeout: 10000 });
    await articleCell.click();
    await page.waitForTimeout(1500);

    // URLコピーボタンをクリック（録画: aria/コピー[role="button"]）
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
    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: "", status: 'error', task_type: 'duplicate' });
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
