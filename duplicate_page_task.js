const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch({ headless: false }); // ★テスト中は動きが見えるように false にしておくのがおすすめです
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // =========================================================
  // 1. 変数の設定（スプシの「beyondページ複製」シートに対応）
  // =========================================================
  const rowIdx = process.env.ROW_IDX || '8'; 
  const folderName = process.env.FOLDER_NAME || '快調ハニー/G008（shinyskinpower.site）'; // E列: フォルダ名
  const sourceArticle = process.env.SOURCE_ARTICLE || '0403_快調ハニー_500円訴求_GDN03'; // F列: 記事名（コピー元）
  const newArticleName = process.env.NEW_ARTICLE_NAME || 'test_0403_快調ハニー_500円訴求_GDN03'; // G列: 新規ページ名
  const deliveryUrl = process.env.DELIVERY_URL || '0415_1'; // H列: 配信URL設定
  const gasUrl = process.env.GAS_WEBAPP_URL;

  const targetUrl = 'https://app.squadbeyond.com/';

  try {
    console.log(`\n=========================================`);
    console.log(`🚀 beyondページ複製 RPA開始 (対象行: ${rowIdx})`);
    console.log(`=========================================`);

    // =========================================================
    // [Step 0] ログイン処理（既存流用）
    // =========================================================
    console.log(`\n[Step 0] ターゲットURLにアクセスします: ${targetUrl}`);
    await page.goto(targetUrl);
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible()) {
      console.log(`  => 🔑 ログイン情報を入力します。`);
      await emailInput.fill(process.env.SQUADBEYOND_ID);
      await page.waitForTimeout(1000);
      await page.locator('input[name="password"]').fill(process.env.SQUADBEYOND_PASS);
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'ログイン' }).first().click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(3000);
    }

    const secondLoginButton = page.getByRole('button', { name: 'ログイン', exact: true });
    if (await secondLoginButton.isVisible()) {
      await secondLoginButton.first().click();
      await page.waitForTimeout(5000); 
      await page.waitForLoadState('load');
    }

    // =========================================================
    // [Step 1-2] フォルダ名を検索してクリック
    // =========================================================
    console.log(`\n[Step 1] 検索窓にフォルダ名「${folderName}」を入力します。`);
    const globalSearch = page.locator('input[type="search"]').first();
    await globalSearch.fill('');
    await globalSearch.pressSequentially(folderName, { delay: 50 });
    await page.waitForTimeout(3000); // 検索結果が出るまで待機

    console.log(`\n[Step 2] 検索結果からフォルダ名をクリックして中に入ります。`);
    // グループリスト内にあるフォルダ名（E列のテキスト）を直接探してクリック
    const folderLink = page.locator('div, li, a').filter({ hasText: folderName }).last();
    await folderLink.click();
    await page.waitForTimeout(3000); // フォルダの中身がロードされるまで待機

    // =========================================================
    // [Step 3] フォルダ内で記事名を検索
    // =========================================================
    console.log(`\n[Step 3] フォルダ内で記事「${sourceArticle}」を検索します。`);
    // フォルダ内の検索窓（媒体/名前検索など）に入力
    const articleSearchInput = page.locator('label').filter({ hasText: '媒体/名前検索' }).locator('xpath=..').locator('input').first();
    
    // もし上記セレクタで検索窓が見つからない場合は、画面右上の共通検索窓を使うフォールバック
    if (await articleSearchInput.isVisible().catch(() => false)) {
        await articleSearchInput.fill('');
        await articleSearchInput.pressSequentially(sourceArticle, { delay: 50 });
    } else {
        const globalSearch2 = page.locator('input[type="search"]').last();
        await globalSearch2.fill('');
        await globalSearch2.pressSequentially(sourceArticle, { delay: 50 });
    }
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 4] 右側のメニューボタン ＞ 「beyondページ複製」をクリック
    // =========================================================
    console.log(`\n[Step 4] 対象記事のメニューを開き、「beyondページ複製」をクリックします。`);
    
    // ターゲット記事の行（Row）を特定
    const articleRow = page.locator('tr, div, li').filter({ hasText: sourceArticle }).filter({ has: page.locator('button') }).last();
    
    // ★既存の最強クリックロジック（CV連携アイコンがあっても確実にメニューを開く）
    const lastCell = articleRow.locator('td').last();
    if (await lastCell.isVisible().catch(() => false)) {
        await lastCell.locator('button').first().click();
    } else {
        const chainIconCount = await articleRow.locator('button').filter({ has: page.locator('path[d^="M67.497"]') }).count();
        if (chainIconCount > 0) {
            await articleRow.locator('button').nth(-3).click(); 
        } else {
            await articleRow.locator('button').nth(-2).click(); 
        }
    }
    await page.waitForTimeout(1000);

    // ★ご指定の「beyondページ複製」リンクをクリック
    console.log(`  => メニュー内から「beyondページ複製」を選択します。`);
    // クラス名ではなく、ユーザーに見えるテキスト「beyondページ複製」で探すのがPlaywrightのセオリーで安定します
    await page.locator('.MuiPopover-root, [role="menu"]').getByText('beyondページ複製', { exact: true }).click();
    
    // もし上記でうまくいかない場合は、ご指定のaタグ要素でクリックするフォールバック
    // await page.locator('a.MuiLink-root').filter({ hasText: 'beyondページ複製' }).click();

    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 5] 複製ポップアップの操作（この部分はUIに合わせて後ほど調整）
    // =========================================================
    console.log(`\n[Step 5] 複製ポップアップに新規情報を入力します。（構築中）`);
    console.log(`  - 予定入力値: 新規ページ名 = ${newArticleName}`);
    console.log(`  - 予定入力値: 配信URL = ${deliveryUrl}`);
    
    // TODO: ここにポップアップ内のテキストボックスを埋めるコードと、
    // 「複製する」ボタンを押すコードを追加していきます。

    console.log(`\n🎉 テスト稼働（Step 4まで）完了しました！`);

  } catch (error) {
    console.error(`\n❌ エラー発生:\n`, error);
    await page.screenshot({ path: 'duplicate-error-screenshot.png', fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
