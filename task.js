const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
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

    // [Step 1] ログイン
    console.log(`\n[Step 1] ターゲットURLにアクセスします: ${targetUrl}`);
    await page.goto(targetUrl);
    await page.waitForLoadState('load');
    await page.waitForTimeout(3000);

    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible().catch(() => false)) {
      console.log(`  => 🔑 ID/PASS入力画面を検知。情報を入力します。`);
      await emailInput.fill(process.env.SQUADBEYOND_ID);
      await page.waitForTimeout(1000);
      await page.locator('input[name="password"]').fill(process.env.SQUADBEYOND_PASS);
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: 'ログイン' }).first().click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(3000);
    }

    const loginBtns = page.getByRole('button', { name: 'ログイン', exact: true });
    if (await loginBtns.count() > 0) {
      console.log(`  => チーム選択画面を検知。チーム「フルアウト」でログインします。`);
      
      const fulloutBtn = page.getByRole('listitem').filter({ hasText: 'フルアウト' }).getByRole('button', { name: 'ログイン', exact: true }).first();
      
      if (await fulloutBtn.isVisible().catch(() => false)) {
          await fulloutBtn.click();
      } else {
          try {
              const exactText = page.getByText('フルアウト', { exact: true }).first();
              await exactText.locator('xpath=ancestor::*[contains(@class, "MuiBox") or contains(@class, "MuiGrid")][1]//button').first().click();
          } catch(e) {
              await loginBtns.first().click();
          }
      }
      await page.waitForTimeout(5000); 
      await page.waitForLoadState('load');
    }

    // =========================================================
    // [Step 1.2] 新旧デザインの確認と切り替え
    // =========================================================
    console.log(`\n[Step 1.2] UIデザインの確認を行います。`);
    const newDesignBtn = page.locator('div, button').filter({ hasText: '新デザインを試す' }).last();
    if (await newDesignBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log(`  => 🎨 旧デザインを検知しました。「新デザインを試す」をクリックして切り替えます。`);
        await newDesignBtn.click();
        await page.waitForLoadState('load');
        await page.waitForTimeout(5000);
    }

    // =========================================================
    // [Step 1.5] 新UI対応（ページメニューのクリック）
    // =========================================================
    console.log(`\n[Step 1.5] 「ページ」メニューをクリックして一覧へ移動します。`);
    const pageMenuIcon = page.locator('svg').filter({ has: page.locator('path[d^="M11 8.5V6.75C11 5.50736"]') }).first();
    
    try {
        const menuWrapper = pageMenuIcon.locator('xpath=ancestor::button | ancestor::a | ancestor::div[@role="button" | @role="menuitem"]').first();
        if (await menuWrapper.isVisible({ timeout: 3000 }).catch(() => false)) {
            await menuWrapper.click();
        } else {
            await pageMenuIcon.click();
        }
    } catch(e) {
        await pageMenuIcon.click();
    }
    console.log(`  => ページ一覧画面のロードを待機しています...`);
    await page.waitForTimeout(5000);

    // =========================================================
    // [Step 2] 新UIでのフォルダ作成フロー
    // =========================================================
    console.log(`\n[Step 2] コピー先のフォルダを新規作成します（新UIフロー）。`);

    console.log(`  - フォルダ作成アイコンをクリックします。`);
    await page.locator('[data-testid="generate-folder-icon"]').click();
    await page.waitForTimeout(1000);

    await page.locator('div[role="dialog"]').getByText('フォルダ作成').first().click();
    await page.waitForTimeout(1000);

    await page.getByText('登録済みドメインから選択').click();
    await page.waitForTimeout(500);

    console.log(`  - 「独自ドメイン」を選択します。`);
    await page.getByText(/が登録したドメインから選択/).first().click();
    await page.waitForTimeout(500);

    await page.getByRole('combobox').filter({ hasText: '独自ドメインを選択する' }).click();
    await page.waitForTimeout(1000);

    console.log(`  - ドメイン「${domain}」を検索して選択します。`);
    await page.keyboard.type(domain, { delay: 50 });
    await page.waitForTimeout(1000); 
    
    await page.getByText(domain, { exact: true }).last().click();
    await page.waitForTimeout(500);

    await page.getByText('次へ', { exact: true }).click();
    await page.waitForTimeout(500);

    await page.getByRole('combobox').filter({ hasText: '指定しない' }).click();
    await page.waitForTimeout(500);

    console.log(`  - グループ「${groupListDest}」を選択します。`);
    await page.getByRole('option', { name: groupListDest, exact: true }).click();
    await page.waitForTimeout(500);

    await page.getByText('次へ', { exact: true }).click();
    await page.waitForTimeout(500);

    await page.getByText('次へ', { exact: true }).click();
    await page.waitForTimeout(500);

    await page.getByText('設定確認', { exact: true }).click();
    await page.waitForTimeout(1000);

    console.log(`  - フォルダ名を入力します: ${destFolder}`);
    await page.getByText('新しいフォルダ', { exact: false }).click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Meta+A'); 
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);

    await page.keyboard.type(destFolder, { delay: 50 });
    await page.waitForTimeout(1000);
    console.log(`  - Enterキーを押して入力をシステムに認識させます。`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const createBtn = page.getByText('作成する', { exact: true }).last();
    if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
    }
    console.log(`  => ⏳ フォルダ作成中...`);
    
    await page.locator('div[role="dialog"]').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // =========================================================
    // [Step 3] コピー元フォルダの検索
    // =========================================================
    console.log(`\n[Step 3] 記事をコピーするため、原本グループ「${groupListSource}」を検索します。`);
    await page.keyboard.press('Escape'); 
    await page.waitForTimeout(500);

    console.log(`  - 左サイドバーの「検索」ボタンをクリックします。`);
    await page.getByText('検索', { exact: true }).first().click();
    await page.waitForTimeout(1000);

    console.log(`  - グループ名「${groupListSource}」を入力して検索します。`);
    await page.keyboard.type(groupListSource, { delay: 50 });
    await page.waitForTimeout(3000);

    console.log(`  - 検索結果から「${groupListSource}」をクリックします。`);
    const originalGroup = page.locator('div').filter({ hasText: groupListSource }).last();
    if (await originalGroup.isVisible({ timeout: 5000 }).catch(() => false)) {
        await originalGroup.click();
        await page.waitForTimeout(2000);
    }
    
    console.log(`  => フォルダ「${sourceFolder}」をクリックします。`);
    try {
        await page.locator('div, li').filter({ hasText: sourceFolder }).filter({ has: page.locator('button') }).last().click();
    } catch(e) {
        const partialKeyword = sourceFolder.split('（')[0].split('(')[0].trim();
        await page.locator('div, li').filter({ hasText: partialKeyword }).filter({ has: page.locator('button') }).last().click();
    }
    console.log(`  => フォルダの中身のロードを待機しています...`);
    await page.waitForTimeout(5000);
    
    // =========================================================
    // [Step 4] 新UIでの記事検索とメニュー展開
    // =========================================================
    console.log(`\n[Step 4] フォルダ内で記事「${sourceArticle}」を検索します。`);
    
    const folderSearchInput = page.getByPlaceholder('フォルダ内検索').first();
    if (await folderSearchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await folderSearchInput.click();
        await folderSearchInput.fill('');
        await folderSearchInput.pressSequentially(sourceArticle, { delay: 50 });
    } else {
        await page.keyboard.press('Control+F');
        await page.keyboard.press('Meta+F');
        await page.waitForTimeout(500);
        await page.keyboard.type(sourceArticle, { delay: 50 });
    }
    await page.waitForTimeout(4000);
    
    // =========================================================
    // [Step 5] 「別フォルダへ複製」を選択
    // =========================================================
    console.log(`\n[Step 5] 「別フォルダへ複製」を選択します。`);
    
    console.log(`  - 記事にマウスカーソルを合わせてメニューボタンを出現させます。`);
    const targetArticleEl = page.getByText(sourceArticle).filter({ state: 'visible' }).first();
    await targetArticleEl.scrollIntoViewIfNeeded().catch(() => {});
    await targetArticleEl.hover();
    await page.waitForTimeout(1000);

    console.log(`  - メニュー（...）ボタンをクリックします。`);
    try {
        const beyondCopyBtn = page.getByText(/beyond(?:page|ページ)複製/i).filter({ state: 'visible' }).last();
        const btnContainer = beyondCopyBtn.locator('xpath=..');
        
        const actionBtns = btnContainer.locator('button, [role="button"], div:has(svg)');
        const count = await actionBtns.count();
        
        if (count > 1) {
            await actionBtns.nth(count - 2).click();
        } else {
            await page.locator('svg:right-of(:textMatches("(?i)beyond(?:page|ページ)複製"))').first().click();
        }
    } catch(e) {
        await page.locator('svg:right-of(:textMatches("(?i)beyond(?:page|ページ)複製"))').first().click();
    }
    await page.waitForTimeout(1000);

    await page.getByText('別フォルダへ複製', { exact: true }).last().click();
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 6] 複製設定の入力（フォルダ内直接検索対応）
    // =========================================================
    console.log(`\n[Step 6] 新規複製ウィザードを進めます。`);

    const activeModal = page.locator('div[role="dialog"]').last();

    console.log(`  - チームを「現在のチーム内」に設定します。`);
    // activeModalの中のコンボボックスをクリック
    await activeModal.locator('button[role="combobox"]').first().click();
    await page.waitForTimeout(500);
    // ★大改修：選択肢はダイアログ外に描画されるため page 全体から探す
    await page.getByText('現在のチーム内', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    console.log(`  - 検索窓にグループ「${groupListDest}」を入力します。`);
    const modalFolderSearch = activeModal.locator('input[type="text"]').first();
    await modalFolderSearch.click();
    await modalFolderSearch.fill('');
    await modalFolderSearch.pressSequentially(groupListDest, { delay: 50 });
    await page.waitForTimeout(2000);

    console.log(`  - 検索結果からグループ「${groupListDest}」をクリックして展開します。`);
    // ★大改修：検索結果の選択肢もダイアログ外に描画されるため page 全体から探す
    const groupOptions = page.getByText(groupListDest);
    const groupCount = await groupOptions.count();
    if (groupCount > 1) {
        await groupOptions.nth(1).click();
    } else {
        await groupOptions.last().click();
    }
    await page.waitForTimeout(2000);

    console.log(`  - 展開されたリストからフォルダ「${destFolder}」を探してクリックします。`);
    // ★大改修：これも page 全体から探す
    const folderTarget = page.getByText(destFolder).last();
    await folderTarget.scrollIntoViewIfNeeded().catch(() => {});
    await folderTarget.click();
    await page.waitForTimeout(1000);

    await activeModal.getByText('次へ', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    if (deliveryUrl) {
      console.log(`  - 配信URL設定を入力します: ${deliveryUrl}`);
      const deliveryInput = activeModal.getByPlaceholder('半角英数字, -, _ が使えます').last();
      await deliveryInput.fill('');
      await deliveryInput.pressSequentially(deliveryUrl, { delay: 50 });
      await page.waitForTimeout(1000);
    }
    
    await activeModal.getByText('保存して次へ', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    await activeModal.getByText('次へ', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    await activeModal.getByText('次へ', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    await activeModal.getByText('次へ', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    await activeModal.getByText('置換せずスキップ', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    await activeModal.getByText('設定確認', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    const finalCopyBtn = activeModal.getByText('この内容でページを複製する', { exact: true }).last();
    await finalCopyBtn.click();
    console.log(`  => ⏳ 複製処理の完了を待機しています...`);
    
    await finalCopyBtn.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
    console.log(`  => ✅ 複製完了！`);
    await page.waitForTimeout(5000); 

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
