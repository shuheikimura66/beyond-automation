const { chromium } = require('playwright');

(async () => {
  // ブラウザを起動（GitHub Actions上では画面なしのheadlessモード）
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. ログインページへ移動
    // ※SquadBeyondのログインURLに書き換えてください
    await page.goto('https://app.squadbeyond.com/login'); 

    // 2. SecretsからIDとパスワードを入力
    // GitHub Actions実行時に環境変数から読み込まれます
    await page.fill('input[name="email"]', process.env.SQUADBEYOND_ID);
    await page.fill('input[name="password"]', process.env.SQUADBEYOND_PASS);
    
    // 3. ログインボタンをクリック
    // 「ログイン」というテキストを持つボタンを探してクリック（動的変化に強い書き方）
    await page.getByRole('button', { name: 'ログイン' }).click();

    // 4. ログイン完了を待つ（ダッシュボードが表示されるまでなど）
    await page.waitForNavigation();

    // 5. GASから渡された「D列のURL」へ移動
    // ※引数としてURLを受け取れるように後ほど調整しますが、まずはテスト用に
    const targetUrl = process.argv[2] || 'https://app.squadbeyond.com/default-path';
    console.log(`アクセス中: ${targetUrl}`);
    await page.goto(targetUrl);

    // --- ここから先の自動操作を追加していく ---
    // 例: 特定のボタンをクリック、B列のデータを入力など
    // ---------------------------------------

    console.log("ターゲットページへの到達に成功しました。");

  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
