const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1372, height: 841 }
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

    // =========================================================
    // [Step 1] ログイン処理（変更なし）
    // =========================================================
    console.log(`\n[Step 1] ターゲットURLにアクセスします: ${targetUrl}`);
    await page.goto(targetUrl);
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    const emailInput = page.locator('input[name="email"]');

    // --- [1] 初回ログイン ---
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

    // --- [2] 強制ログアウト ---
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

    // --- [3] 再ログイン ---
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

    // --- [4] フルアウト選択 ---
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

    // =========================================================
    // [Step 1.5] ページメニュークリック（更新：新UIセレクター）
    // 旧: SVGパス path[d^="M11 8.5V6.75C11 5.50736"] でフィルター
    // 新: data-testid="list-menu-item" の3番目をクリック
    // =========================================================
    console.log(`\n[Step 1.5] 「ページ」メニューをクリックします。`);
    // ナビゲーションが揃うまで待機してからクリック
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

    // 旧: "フォルダ作成" / 新: "フォルダ作成..."（末尾に...が追加）
    console.log(`  - 「フォルダ作成...」をクリックします。`);
    await page.getByText('フォルダ作成...', { exact: true }).click();
    await page.waitForTimeout(1000);

    // 新: ラジオボタンで「独自ドメイン」を選択（1回だけクリック）
    console.log(`  - 「独自ドメイン」を選択します。`);
    await page.getByText('独自ドメイン', { exact: true }).click();
    await page.waitForTimeout(1500); // comboboxが有効になるまで待機

    // 「独自ドメインを選択する」comboboxが有効になったらクリック
    const domainCombobox = page.getByRole('combobox').filter({ hasText: '独自ドメインを選択する' });
    await domainCombobox.waitFor({ state: 'visible' });
    await domainCombobox.click();
    await page.waitForTimeout(500);

    // ドメインを入力して絞り込み
    console.log(`  - ドメイン「${domain}」を入力します。`);
    await page.locator('input').last().fill(domain);
    await page.waitForTimeout(1000);

    // ドロップダウンから一致するドメインを選択して確定
    await page.getByText(domain, { exact: true }).last().click();
    await page.waitForTimeout(1000);

    // div.css-1vn620w はグループ選択を開くトリガーボタン（forceなし）
    console.log(`  - グループ選択を開きます。`);
    await page.locator('div.css-1vn620w').click();
    await page.waitForTimeout(1000);

    // グループのポップオーバーが開いたらinputが現れるので入力
    console.log(`  - グループ「${groupListDest}」を入力して選択します。`);
    const groupInput = page.locator('input').last();
    await groupInput.waitFor({ state: 'visible', timeout: 5000 });
    await groupInput.fill(groupListDest);
    await page.waitForTimeout(1000);
    await page.getByText(groupListDest, { exact: true }).last().click();
    await page.waitForTimeout(500);

    // 設定確認
    await page.getByText('設定確認', { exact: true }).click();
    await page.waitForTimeout(1000);

    // 作成する
    console.log(`  - 「作成する」をクリックしてフォルダを作成します。`);
    await page.locator('div.css-1wtvhju').getByText('作成する', { exact: true }).click();
    console.log(`  => ⏳ フォルダ作成中...`);
    await page.waitForTimeout(5000);

    // =========================================================
    // [Step 2.5] フォルダ名称変更（新UIで追加されたフロー）
    // 旧: 作成ダイアログ内でフォルダ名を入力していた
    // 新: 作成後にサイドバーから「名称変更」で設定する
    // =========================================================
    console.log(`\n[Step 2.5] 作成したフォルダを「${destFolder}」に名称変更します。`);

    // ダイアログが完全に閉じるまで待つ
    await page.locator('div[role="dialog"]').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // /folders に直接移動
    console.log(`  - /folders に移動してページ一覧ビューに戻ります。`);
    await page.goto('https://app.squadbeyond.com/folders');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    // 左上の「検索」ボタンをクリックして検索パネルを開く
    // （録画時はパネルが開いた状態から始まっていたため、このクリックが必要）
    console.log(`  - 「検索」ボタンをクリックして検索パネルを開きます。`);
    await page.getByRole('button', { name: /^検索$/ }).first().click();
    await page.waitForTimeout(800);

    // side-menu内の検索input（label内）で「新しいフォルダ」を検索
    // 録画XPath: //*[@data-testid="side-menu"]/div[1]/div[1]/div/div/label/input
    console.log(`  - 「新しいフォルダ」を検索します。`);
    const sideMenuInput = page.locator('xpath=//*[@data-testid="side-menu"]/div[1]/div[1]/div/div/label/input');
    await sideMenuInput.waitFor({ state: 'visible', timeout: 5000 });
    await sideMenuInput.fill('新しいフォルダ');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // 検索結果の3ドットボタンをクリック
    // 録画XPath: //*[@data-testid="list-menu-item"]/div[3]/div/div[2]/button
    console.log(`  - 3ドットボタンをクリックします。`);
    await page.locator('xpath=//*[@data-testid="list-menu-item"]/div[3]/div/div[2]/button').first().click();
    await page.waitForTimeout(500);

    // 名称変更
    await page.getByText('名称変更', { exact: true }).click();
    await page.waitForTimeout(500);

    // 全選択して新しいフォルダ名を入力
    await page.keyboard.press('Control+A');
    await page.keyboard.type(destFolder, { delay: 50 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // =========================================================
    // [Step 3] コピー元フォルダを検索パネルで直接検索してクリック
    // =========================================================
    console.log(`\n[Step 3] 原本フォルダ「${sourceFolder}」を検索します。`);

    // 検索パネルが閉じていれば再度開く
    const sideMenuInput3 = page.locator('xpath=//*[@data-testid="side-menu"]/div[1]/div[1]/div/div/label/input');
    if (!(await sideMenuInput3.isVisible({ timeout: 1500 }).catch(() => false))) {
      console.log(`  - 「検索」ボタンをクリックして検索パネルを開きます。`);
      await page.getByRole('button', { name: /^検索$/ }).first().click();
      await page.waitForTimeout(800);
    }

    // sourceFolder を検索して直接クリック（groupListSource経由の階層操作を廃止）
    console.log(`  - 「${sourceFolder}」を検索してクリックします。`);
    await sideMenuInput3.fill(sourceFolder);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    await page.locator('[data-testid="list-menu-item"]')
      .filter({ hasText: sourceFolder }).first().click();
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 4] 記事検索（新UIセレクター）
    // =========================================================
    console.log(`\n[Step 4] フォルダ内で記事「${sourceArticle}」を検索します。`);

    // 旧: getByText('フォルダ内検索') / 新: button.efy50tl0
    await page.locator('button.efy50tl0').click();
    await page.waitForTimeout(500);

    // 旧: input[placeholder*="内を検索"] / 新: div.css-68s747 input
    await page.locator('div.css-68s747 input').first().fill(sourceArticle);
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 5] 「別フォルダへ複製」を選択
    // 旧: button.css-16dhtfm（生成クラス）
    // 新: [data-testid='option-icon']（録画から取得）
    // =========================================================
    console.log(`\n[Step 5] 「別フォルダへ複製」を選択します。`);

    // 記事行にhoverしてoption-iconを出現させてからクリック
    const articleItem = page.getByText(sourceArticle, { exact: true }).first();
    await articleItem.waitFor({ state: 'visible', timeout: 10000 });
    await articleItem.hover();
    await page.waitForTimeout(500);
    await page.locator('[data-testid="option-icon"]').first().click();
    await page.waitForTimeout(500);

    await page.getByText('別フォルダへ複製', { exact: true }).last().click();
    await page.waitForTimeout(2000);

    // =========================================================
    // [Step 6] 複製設定（録画セレクターに更新）
    // =========================================================
    console.log(`\n[Step 6] 複製ウィザードを進めます（新UI対応）。`);

    const activeModal = page.locator('div[role="dialog"]').last();

    // 複製先チーム選択
    console.log(`  - 複製先チームを「現在のチーム内」に設定します。`);
    await activeModal.locator('section:nth-of-type(1) div.css-18ji2p4 > div').click();
    await page.waitForTimeout(500);
    await page.getByText('現在のチーム内', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    // 複製先フォルダ選択
    console.log(`  - 複製先フォルダ「${destFolder}」を選択します。`);
    await activeModal.locator('section:nth-of-type(2) div.css-18ji2p4 > div').click();
    await page.waitForTimeout(500);

    // フォルダ名を入力して絞り込み
    await page.locator('div:nth-of-type(10) input').fill(destFolder);
    await page.waitForTimeout(2000);

    // グループをクリックして展開
    await page.getByText(groupListDest, { exact: true }).last().click();
    await page.waitForTimeout(1000);

    // フォルダをクリック
    // 旧: div.css-d3v9zr div.css-79rqsy（生成クラス）
    // 新: [data-testid="list-menu-item"] div:nth-of-type(2)（録画から取得）
    await page.locator('[data-testid="list-menu-item"]')
      .filter({ hasText: destFolder }).last()
      .locator('div:nth-of-type(2)').click();
    await page.waitForTimeout(1000);

    // 配信URL入力（録画 0607_1.json: section[3] → URL input → Tab でblur）
    if (deliveryUrl) {
      console.log(`  - 配信URLを入力します: ${deliveryUrl}`);
      const urlInput = activeModal.locator('section:nth-of-type(3) input').first();
      await urlInput.waitFor({ state: 'visible', timeout: 5000 });
      await urlInput.click();
      await urlInput.fill(deliveryUrl);
      await page.keyboard.press('Tab'); // blur してバリデーション確定（録画のコンテナクリックと同等）
      await page.waitForTimeout(500);
    }

    // ページ名accordion → 入力（録画: 「🙆いつでも変更可能です」クリック後に name input）
    const pageNameAccordion = page.getByText('いつでも変更可能です').last();
    if (await pageNameAccordion.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pageNameAccordion.click();
      await page.waitForTimeout(800);
      // ページ名は自動生成のまま（task.js では newArticleName を使わない）
      // → inputに触れず skip（ランダム文字列が自動設定される）
    }

    // 設定確認（録画: 別フォルダへ複製では必要）
    await page.getByText('設定確認', { exact: true }).last().click();
    await page.waitForTimeout(2000);

    // 複製実行
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
    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: "", status: 'error' });
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
