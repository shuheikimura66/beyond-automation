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
    
    // 【例】グループリストを開く、フォルダを作成する、ドメインを選ぶ...
    // ※この部分のコードをこれから一緒に作っていきます！

  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
