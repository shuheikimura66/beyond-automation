const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1372, height: 841 },
    permissions: ['clipboard-read', 'clipboard-write'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  let page = await context.newPage();

  // =========================================================
  // 1. 変数の設定
  // =========================================================
  const rowIdx          = process.env.ROW_IDX;
  const groupListSource = process.env.GROUP_LIST_NAME_SOURCE; 
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
    // [Step 1] ログイン処理（確実な入力＋人間らしいマウス操作）
    // =========================================================
    console.log(`\n[Step 1] ターゲットURLにアクセスします: ${targetUrl}`);
    await page.goto(targetUrl);
    
    try {
        await page.waitForSelector('input[name="email"], input[type="email"], [data-testid="list-menu-item"]', { timeout: 15000 });
    } catch(e) {}

    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    const passInput = page.locator('input[name="password"], input[type="password"]').first();

    // 1回目のログイン
    if (await emailInput.isVisible().catch(() => false)) {
      console.log(`  => 🔑 ログイン画面を検知。安定したフローで入力します。`);
      
      // ★修正: 文字抜けを防ぐため fill に戻しつつ、クリックの長押し(delay)でBot回避
      await emailInput.click({ delay: 100 });
      await emailInput.fill(process.env.SQUADBEYOND_ID);
      await page.waitForTimeout(300);

      await passInput.click({ delay: 100 });
      await passInput.fill(process.env.SQUADBEYOND_PASS);
      await page.waitForTimeout(500);

      console.log(`  => ⏳ ログインボタンをクリックして遷移を待機します...`);
      const loginBtn = page.getByRole('button', { name: 'ログイン' }).first();
      
      // ★追加: 人間のようにボタンをホバーしてからクリックする
      await loginBtn.hover();
      await page.waitForTimeout(300);
      await loginBtn.click({ delay: 100 });

      try {
        // ★修正: 「メール入力欄が消えること」をログイン成功の絶対条件にする
        await emailInput.waitFor({ state: 'hidden', timeout: 15000 });
        console.log(`  => ✅ ログイン通信完了 (URL: ${page.url()})`);
      } catch (e) {
        console.log(`  => ⚠️ 遷移タイムアウト。無限ロードまたは入力エラーの可能性があります。`);
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

    // 2回目のログイン
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.click({ delay: 100 });
      await emailInput.fill(process.env.SQUADBEYOND_ID);
      await page.waitForTimeout(300);

      await passInput.click({ delay: 100 });
      await passInput.fill(process.env.SQUADBEYOND_PASS);
      await page.waitForTimeout(500);

      console.log(`  => ⏳ ログインボタンをクリックして遷移を待機します...`);
      const loginBtn = page.getByRole('button', { name: 'ログイン' }).first();
      await loginBtn.hover();
      await page.waitForTimeout(300);
      await loginBtn.click({ delay: 100 });

      try {
        await emailInput.waitFor({ state: 'hidden', timeout: 15000 });
        console.log(`  => ✅ ログイン通信完了 (URL: ${page.url()})`);
      } catch (e) {
        console.log(`  => ⚠️ 再ログイン遷移タイムアウト`);
      }
      await page.waitForTimeout(2000);
    }

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

    // =========================================================
    // [Step 2] コピー元フォルダへ移動
    // =========================================================
    console.log(`\n[Step 2] コピー元フォルダ「${sourceFolder}」へ移動します。`);
    await page.goto('https://app.squadbeyond.com/folders');
    await page.waitForLoadState('load');
    await page.waitForTimeout(2000);

    if (!page.url().includes('/folders')) {
      const fulloutRetry = page.locator('div').filter({ hasText: /^フルアウト$/ }).last();
      if (await fulloutRetry.isVisible({ timeout: 5000 }).catch(() => false)) {
        await fulloutRetry.click();
        await page.waitForTimeout(3000);
        await page.waitForLoadState('load');
      }
      await page.goto('https://app.squadbeyond.com/folders');
      await page.waitForLoadState('load');
      await page.waitForTimeout(2000);
    }

    console.log(`  - 「検索」をクリックして検索ポップアップを開きます。`);
    const searchTrigger1 = page.locator('input[placeholder*="検索"], [placeholder*="検索"]').first();
    if (await searchTrigger1.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchTrigger1.click();
    } else {
        await page.getByText('検索', { exact: true }).first().click();
    }
    await page.waitForTimeout(1500);

    console.log(`  - コピー元フォルダ名を入力します。`);
    const sideMenuInput = page.locator('div[role="dialog"] input').first().or(page.locator('input').last());
    await sideMenuInput.waitFor({ state: 'visible', timeout: 10000 });
    await sideMenuInput.fill(sourceFolder);
    await page.waitForTimeout(2000); 

    const folderTab2 = page.locator('span').filter({ hasText: /^フォルダ/ }).last();
    await folderTab2.waitFor({ state: 'visible', timeout: 10000 });
    await folderTab2.click();
    await page.waitForTimeout(1000);

    console.log(`  - 検索結果から「${sourceFolder}」をクリックします。`);
    const markResult = page.locator('[data-testid="list-menu-item"] mark').first();
    await markResult.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log(`  => 📄 新しいタブが開くのを待機します...`);
    const [newPageSource] = await Promise.all([
      context.waitForEvent('page'),
      markResult.click()
    ]);
    page = newPageSource;
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 3] 記事検索
    // =========================================================
    console.log(`\n[Step 3] 新しいタブのフォルダ内で記事「${sourceArticle}」を検索します。`);

    const folderSearchInput = page.locator('input[placeholder*="フォルダ内検索"], input[placeholder*="検索"]').last();
    if (!(await folderSearchInput.isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.locator('button.efy50tl0').click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await folderSearchInput.waitFor({ state: 'visible', timeout: 10000 });
    await folderSearchInput.fill(sourceArticle);
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 4] option-icon → 「別フォルダへ複製」
    // =========================================================
    console.log(`\n[Step 4] 対象記事のメニューを開きます。`);

    console.log(`  - 意図せぬポップアップを解除するため、画面外をクリックしEscキーを押します。`);
    await page.keyboard.press('Escape');
    await page.mouse.click(10, 10);
    await page.waitForTimeout(500);

    const articleItem = page.getByText(sourceArticle).first();
    await articleItem.waitFor({ state: 'visible', timeout: 10000 });
    
    try {
        await articleItem.hover({ timeout: 5000 });
    } catch (e) {
        console.log(`  => ⚠️ ホバーが妨害されました。再度リトライします。`);
        await page.keyboard.press('Escape');
        await page.mouse.click(10, 10);
        await page.waitForTimeout(500);
        await articleItem.hover();
    }
    await page.waitForTimeout(500);

    await page.locator('[data-testid="option-icon"]').first().click();
    await page.waitForTimeout(500);

    console.log(`  => 「別フォルダへ複製」を選択します。`);
    const duplicateMenuItem = page.getByText('別フォルダへ複製', { exact: true }).last();
    await duplicateMenuItem.waitFor({ state: 'visible', timeout: 10000 });
    await duplicateMenuItem.click();
    await page.waitForTimeout(2000);

    // =========================================================
    // [Step 5] 複製設定ダイアログ
    // =========================================================
    console.log(`\n[Step 5] 複製ウィザードを進めます。`);

    const activeModal = page.locator('div[role="dialog"]').last();

    console.log(`  - 1. チームを「現在のチーム内」に設定します。`);
    await activeModal.locator('section:nth-of-type(1) div.css-18ji2p4 > div').click();
    await page.waitForTimeout(500);
    await page.getByText('現在のチーム内', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    console.log(`  - 2. 複製先フォルダを選択します。`);
    await activeModal.locator('section:nth-of-type(2) div.css-18ji2p4 > div').click();
    await page.waitForTimeout(1000); 

    console.log(`  - 検索窓に「${destFolder}」を入力します。`);
    const destFolderSearchInput = page.locator('input').last();
    await destFolderSearchInput.waitFor({ state: 'visible', timeout: 5000 });
    await destFolderSearchInput.click();
    await destFolderSearchInput.fill(destFolder);
    await page.waitForTimeout(2000);

    const portalsStep6 = page.locator('body > div:not(#root)');

    if (groupListDest && groupListDest.trim() !== "") {
        console.log(`  - グループ「${groupListDest}」をクリックして展開します。`);
        const targetGroup = portalsStep6.getByText(groupListDest).filter({ hasNot: page.locator('div') }).last();
        await targetGroup.waitFor({ state: 'visible', timeout: 5000 }).catch(()=>{});
        await targetGroup.click();
        await page.waitForTimeout(1000);
    } else {
        console.log(`  - ⚠️ グループ指定なしのため、グループ展開をスキップします。`);
    }

    console.log(`  - フォルダ「${destFolder}」をクリックします。`);
    const targetFolder = portalsStep6.getByText(destFolder).filter({ hasNot: page.locator('div') }).last();
    await targetFolder.waitFor({ state: 'visible', timeout: 5000 }).catch(()=>{});
    await targetFolder.click();
    await page.waitForTimeout(1000);

    console.log(`  - 3. 「⚠️後から変更できません」をクリックしてURLタブを開きます。`);
    await page.getByText('⚠️後から変更できません').click();
    await page.waitForTimeout(500);

    if (deliveryUrl) {
      console.log(`  - 配信URL「${deliveryUrl}」を入力します。`);
      const urlInput = activeModal.locator('section:nth-of-type(3) input').first();
      await urlInput.waitFor({ state: 'visible', timeout: 5000 });
      await urlInput.click();
      await urlInput.fill(deliveryUrl);
      await page.keyboard.press('Tab'); 
      await page.waitForTimeout
