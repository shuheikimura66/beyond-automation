const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  // ブラウザの起動
  const browser = await chromium.launch();
  // 動画保存の設定を追加（videos/ フォルダに保存）
  const context = await browser.newContext({
    recordVideo: { dir: 'videos/' },
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // GASから送られてきた環境変数の取得
  const rowIdx = process.env.ROW_IDX;
  const domain = process.env.DOMAIN;
  const groupName = process.env.GROUP_NAME;
  const targetUrl = process.env.TARGET_URL;
  const accountName = process.env.ACCOUNT_NAME;
  const articleName = process.env.ARTICLE_NAME;
  const searchKeyword = process.env.SEARCH_KEYWORD;
  const targetArticle = process.env.TARGET_ARTICLE;
  const gasUrl = process.env.GAS_WEBAPP_URL;

  let entryUrl = ""; // 最終的に取得するURLを入れる変数

  try {
    console.log(`--- RPA開始 (行: ${rowIdx}) ---`);

    // 1. ログイン処理
    await page.goto('https://app.squadbeyond.com/login'); 
    await page.fill('input[name="email"]', process.env.SQUADBEYOND_ID);
    await page.fill('input[name="password"]', process.env.SQUADBEYOND_PASS);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForNavigation();
    console.log("ログイン成功");

    // 2. ターゲットURL（D列）へ移動
    await page.goto(targetUrl);
    await page.waitForLoadState('networkidle');

    // 3. 検索窓に「木村」と入力
    await page.locator('input[type="search"]').first().fill('木村');

    // 4. グループ名のメニュー「：」をクリックしてフォルダ作成
    const menuButton = page.locator(`div:has-text("${groupName}")`).locator('button').last();
    await menuButton.click();
    await page.getByRole('button', { name: 'フォルダ作成' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'フォルダ作成' }).click();

    // 5. フォルダ作成モーダルの入力
    await page.locator('input[type="text"][required]').fill(accountName); // フォルダ名(F列)
    await page.getByLabel('認証済み独自ドメイン').click();
    await page.getByRole('option', { name: domain }).click(); // ドメイン(B列)
    await page.getByRole('button', { name: '作成する' }).click();
    await page.waitForLoadState('networkidle');
    console.log("フォルダ作成完了");

    // 6. 記事の検索と複製
    await page.locator('input[type="search"]').first().fill(searchKeyword); // K列で検索
    await page.waitForTimeout(1000);
    await page.getByText('原本グループ').click();
    
    // 記事名の検索（媒体/名前検索窓）
    await page.getByPlaceholder('媒体/名前検索').fill(targetArticle); // L列で検索
    await page.waitForTimeout(1000);
    
    // 記事のメニュー「：」をクリック
    const articleMenu = page.locator(`div:has-text("${targetArticle}")`).locator('button').last();
    await articleMenu.click();
    await page.getByText('別フォルダへ複製').click();

    // 7. 複製設定の入力
    await page.locator('input[type="text"].MuiFilledInput-input').first().fill(targetArticle);
    await page.getByRole('button', { name: /​/ }).click(); // チーム選択
    await page.getByRole('option', { name: 'フルアウト' }).click();
    
    const folderInput = page.locator('input[role="combobox"]');
    await folderInput.fill(accountName); // 作成したフォルダを選択
    await page.getByRole('option', { name: accountName }).click();
    
    await page.getByRole('button', { name: '複製する' }).click();
    await page.waitForLoadState('networkidle');
    console.log("記事複製完了");

    // 8. 最終的なURLの取得
    // 作成したフォルダを再検索して選択
    await page.locator('input[type="search"]').first().fill(accountName);
    await page.getByText(accountName, { exact: true }).click();
    await page.waitForLoadState('networkidle');

    // 記事メニューからURLをコピー/取得
    const resultMenu = page.locator(`div:has-text("${targetArticle}")`).locator('button').last();
    await resultMenu.click();

    // URLの抽出（FileCopyIconの親要素等から取得を試行）
    // ※サイトの仕様に合わせ、ここで取得ロジックを実行
    entryUrl = await page.evaluate(() => {
        const input = document.querySelector('input[readonly]');
        return input ? input.value : location.href;
    });
    console.log(`取得URL: ${entryUrl}`);

    // --- GASへ成功報告 ---
    if (gasUrl) {
      await axios.post(gasUrl, {
        row_idx: rowIdx,
        entry_url: entryUrl,
        status: 'success'
      });
      console.log("GASへの書き戻し完了");
    }

  } catch (error) {
    console.error("エラーが発生しました:", error);
    // --- GASへエラー報告 ---
    if (gasUrl) {
      await axios.post(gasUrl, {
        row_idx: rowIdx,
        entry_url: "",
        status: 'error'
      }).catch(e => console.error("GAS報告失敗:", e));
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
