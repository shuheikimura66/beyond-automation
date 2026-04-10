const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. GASから送られてきたデータを環境変数から取得
    const rowIdx = process.env.ROW_IDX;
    const domain = process.env.DOMAIN;
    const groupName = process.env.GROUP_NAME;
    const targetUrl = process.env.TARGET_URL;
    const accountName = process.env.ACCOUNT_NAME;
    const articleName = process.env.ARTICLE_NAME;

    console.log(`--- 実行データ (行: ${rowIdx}) ---`);
    console.log(`ドメイン: ${domain}`);
    console.log(`ターゲットURL: ${targetUrl}`);
    console.log(`アカウント名: ${accountName}`);

    // 2. ログイン処理
    await page.goto('https://app.squadbeyond.com/login'); 
    await page.fill('input[name="email"]', process.env.SQUADBEYOND_ID);
    await page.fill('input[name="password"]', process.env.SQUADBEYOND_PASS);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForNavigation();
    console.log("ログインに成功しました。");

    // 3. スプレッドシートのD列のURL（ターゲット）へ直接移動
    console.log(`ターゲットURLへ移動中: ${targetUrl}`);
    await page.goto(targetUrl);
    
    // ページが完全に読み込まれるまで少し待機
    await page.waitForLoadState('networkidle');
    console.log("ターゲットページの読み込みが完了しました。");

    // ==========================================
    // 4. ここから実際の画面操作（動画の動き）を実装します
    // ==========================================
  

    // ① 検索窓に「木村」と入力する
    // ※idは動的に変わるため、役割(searchbox)または属性(type="search")で指定します。
    console.log("検索窓に『木村』と入力します...");
    
    // 方法A: ロール（役割）で探す場合
    const searchInput = page.getByRole('searchbox');
    
    // もし画面内に複数の検索窓があって上記でエラーになる場合は、こちらを使います
    // const searchInput = page.locator('input[type="search"]').first();

    // 検索窓に入力
    await searchInput.fill('木村');

    // もし入力後に「Enterキー」を押す必要がある場合は、以下の行のコメントアウト(//)を外してください。
    // await searchInput.press('Enter');
    
    // 検索結果が読み込まれるまで少し待つ（必要に応じて）
    await page.waitForLoadState('networkidle');




    

  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
