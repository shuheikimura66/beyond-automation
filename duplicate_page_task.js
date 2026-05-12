const { chromium } = require('playwright');
const axios = require('axios');

(async () => {
  const browser = await chromium.launch(); 
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();

  // =========================================================
  // 1. 変数の設定
  // =========================================================
  const rowIdx = process.env.ROW_IDX; 
  const groupListSource = process.env.GROUP_LIST_NAME_SOURCE; 
  const sourceFolder = process.env.FOLDER_NAME_SOURCE; 
  const sourceArticle = process.env.SOURCE_ARTICLE; 
  
  const groupListDest = process.env.GROUP_LIST_NAME_DEST; 
  const destFolder = process.env.FOLDER_NAME_DEST; 
  const newArticleName = process.env.NEW_ARTICLE_NAME; 
  
  const deliveryUrl = process.env.DELIVERY_URL; 
  const gasUrl = process.env.GAS_WEBAPP_URL;

  const isSameFolder = (sourceFolder === destFolder);
  const targetUrl = 'https://app.squadbeyond.com/';

  try {
    console.log(`\n=========================================`);
    console.log(`🚀 beyondページ複製 RPA開始 (対象行: ${rowIdx})`);
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

    // ★改修：task.jsと同じく「フルアウト」チームを確実に選択するロジック
    const teamLoginBtns = page.getByRole('button', { name: 'ログイン', exact: true });
    if (await teamLoginBtns.count() > 1) {
      console.log(`  => チーム選択画面を検知。チーム「フルアウト」でログインします。`);
      
      try {
          // 「フルアウト」の文字を含み、かつ「ログイン」ボタンを内包する一番深い要素(行)を特定してクリック
          const teamRow = page.locator('*:has-text("フルアウト")').filter({ has: page.getByRole('button', { name: 'ログイン', exact: true }) }).last();
          await teamRow.getByRole('button', { name: 'ログイン', exact: true }).first().click();
      } catch(e) {
          console.log(`    ⚠️ 特定に失敗しました。先頭のチームでログインします。`);
          await teamLoginBtns.first().click();
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

    console.log(`  - サブメニューが被るのを防ぐため、マウスカーソルを安全地帯へ退避させます。`);
    await page.mouse.move(1000, 10);
    await page.waitForTimeout(1000);

    console.log(`  => ページ一覧画面のロードを待機しています...`);
    await page.waitForTimeout(5000);

    // =========================================================
    // [Step 2] コピー元フォルダの検索
    // =========================================================
    console.log(`\n[Step 2] コピー元グループ「${groupListSource}」を検索します。`);
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
    // [Step 3] 新UIでの記事検索とメニュー展開
    // =========================================================
    console.log(`\n[Step 3] フォルダ内で記事「${sourceArticle}」を検索します。`);
    
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
    // [Step 4] 「別フォルダへ複製」を選択（ホバー＋右隣のボタン）
    // =========================================================
    console.log(`\n[Step 4] 「別フォルダへ複製」を選択します。`);
    
    console.log(`  - 記事のテキストを直接ホバーしてメニューを出現させます。`);
    const targetArticleText = page.getByText(sourceArticle).filter({ state: 'visible' }).first();
    await targetArticleText.scrollIntoViewIfNeeded().catch(() => {});
    await targetArticleText.hover();
    await page.waitForTimeout(1000);

    console.log(`  - メニュー（...）ボタンをクリックします。`);
    try {
        const copyBtn = page.locator('button, div[role="button"]').filter({ hasText: 'beyondページ複製' }).filter({ state: 'visible' }).first();
        
        if (await copyBtn.isVisible().catch(() => false)) {
            await copyBtn.locator('xpath=following-sibling::*[1]').click();
        } else {
            const beyondText = page.getByText('beyondページ複製').filter({ state: 'visible' }).last();
            const btnGroup = beyondText.locator('xpath=..');
            const actionBtns = btnGroup.locator('button');
            const count = await actionBtns.count();
            if (count >= 2) {
                await actionBtns.nth(count - 2).click();
            } else {
                throw new Error("フォールバックも失敗");
            }
        }
    } catch(e) {
        await page.locator('button:right-of(:text("beyondページ複製"))').first().click();
    }
    await page.waitForTimeout(1000);

    await page.getByText('別フォルダへ複製', { exact: true }).last().click();
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 5] 複製設定の入力（フォルダ内直接検索対応）
    // =========================================================
    console.log(`\n[Step 5] 新規複製ウィザードを進めます。`);

    const activeModal = page.locator('div[role="dialog"]').last();

    console.log(`  - チームを「現在のチーム内」に設定します。`);
    await activeModal.locator('button[role="combobox"]').first().click();
    await page.waitForTimeout(500);
    await page.getByText('現在のチーム内', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    console.log(`  - 検索窓にグループ「${groupListDest}」を入力します。`);
    const modalFolderSearch = activeModal.locator('input[type="text"]').first();
    await modalFolderSearch.click();
    await modalFolderSearch.fill('');
    await modalFolderSearch.pressSequentially(groupListDest, { delay: 50 });
    await page.waitForTimeout(2000);

    console.log(`  - 検索結果からグループ「${groupListDest}」をクリックして展開します。`);
    const groupOptions = page.getByText(groupListDest);
    const groupCount = await groupOptions.count();
    if (groupCount > 1) {
        await groupOptions.nth(1).click();
    } else {
        await groupOptions.last().click();
    }
    await page.waitForTimeout(2000);

    console.log(`  - 展開されたリストからフォルダ「${destFolder}」を探してクリックします。`);
    const folderTarget = page.getByText(destFolder).last();
    await folderTarget.scrollIntoViewIfNeeded().catch(() => {});
    await folderTarget.click();
    await page.waitForTimeout(1000);

    await activeModal.getByText('次へ', { exact: true }).last().click();
    await page.waitForTimeout(1000);

    console.log(`\n[Step 5.5] 複製ウィザードに新規情報を入力します。`);
    
    if (deliveryUrl) {
        console.log(`  - 配信URL設定を入力します: ${deliveryUrl}`);
        const deliveryInput = activeModal.getByPlaceholder('半角英数字, -, _ が使えます').last();
        if (await deliveryInput.isVisible().catch(() => false)) {
            await deliveryInput.fill('');
            await deliveryInput.pressSequentially(deliveryUrl, { delay: 50 });
            await page.waitForTimeout(1000);
            await page.keyboard.press('Enter'); 
        }
    }

    console.log(`  - 「ページ名」タブをクリックします。`);
    try {
        const pageNameTab = activeModal.locator('button').filter({ hasText: 'ページ名' }).first();
        await pageNameTab.click();
        await page.waitForTimeout(1000);
    } catch(e) {
        console.log(`    ⚠️ ページ名タブが見つからないため、そのまま進みます。`);
    }

    console.log(`  - beyondページ名を「${newArticleName}」に変更します。`);
    try {
        const pageNameInput = activeModal.locator('input[type="text"]').filter({ state: 'visible' }).first();
        await pageNameInput.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Meta+A'); 
        await page.keyboard.press('Backspace');
        await pageNameInput.pressSequentially(newArticleName, { delay: 50 });
        await page.waitForTimeout(1000);
    } catch(e) {
        console.log(`    ⚠️ ページ名の入力欄が見つかりませんでした。`);
    }

    // =========================================================
    // ウィザードを1つずつ「出現を待ってから」確実にクリックする関数
    // =========================================================
    const clickWizardButton = async (buttonNames, stepLog) => {
        console.log(`  - ${stepLog} を探してクリックします。`);
        for (let i = 0; i < 20; i++) { 
            for (const name of buttonNames) {
                const btn = activeModal.getByText(name, { exact: true }).last();
                if (await btn.isVisible()) {
                    await btn.click();
                    await page.waitForTimeout(1000); 
                    return; 
                }
            }
            await page.waitForTimeout(500); 
        }
        console.log(`    ⚠️ 警告: [${buttonNames.join(', ')}] が見つかりませんでしたが次へ進みます。`);
    };

    await clickWizardButton(['保存して次へ'], '① 保存して次へ');
    await clickWizardButton(['次へ'], '② 次へ');
    await clickWizardButton(['次へ'], '③ 次へ');
    await clickWizardButton(['次へ'], '④ 次へ');
    await clickWizardButton(['保存して次へ', '置換せずスキップ'], '⑤ 保存して次へ / 置換せずスキップ');
    await clickWizardButton(['設定確認'], '⑥ 設定確認');

    console.log(`  - ⑦ 「この内容でページを複製する」をクリックします。`);
    const finalCopyBtn = activeModal.getByText('この内容でページを複製する', { exact: true }).last();
    await finalCopyBtn.waitFor({ state: 'visible', timeout: 10000 });
    await finalCopyBtn.click();
    
    console.log(`  => ⏳ 複製処理の完了を待機しています...`);
    
    // =========================================================
    // [Step 6] 複製完了ポップアップの処理とフォルダ遷移
    // =========================================================
    try {
        await page.getByText('複製が完了しました！').first().waitFor({ state: 'visible', timeout: 45000 });
    } catch (e) {
        throw new Error('❌ 複製完了ポップアップが表示されませんでした。ウィザードが途中で止まった可能性があります。');
    }
    await page.waitForTimeout(2000);

    if (isSameFolder) {
        console.log(`  => 同じフォルダ内なので「このフォルダで作業を続ける」をクリックします。`);
        await page.getByText('このフォルダで作業を続ける', { exact: true }).last().click();
    } else {
        console.log(`  => 別フォルダなので「複製先フォルダで作業を始める」をクリックします。`);
        await page.getByText('複製先フォルダで作業を始める', { exact: true }).last().click();
    }
    
    console.log(`  => フォルダのロードを待機しています...`);
    await page.waitForTimeout(5000);

    // =========================================================
    // [Step 7] 複製された記事の検索とURLコピー
    // =========================================================
    console.log(`\n[Step 7] 複製されたページ「${newArticleName}」を検索してURLをコピーします。`);
    
    const destSearchInput = page.getByPlaceholder('フォルダ内検索').first();
    if (await destSearchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await destSearchInput.click();
        await destSearchInput.fill('');
        await destSearchInput.pressSequentially(newArticleName, { delay: 50 });
    } else {
        await page.keyboard.press('Control+F');
        await page.keyboard.press('Meta+F');
        await page.waitForTimeout(500);
        await page.keyboard.type(newArticleName, { delay: 50 });
    }
    await page.waitForTimeout(4000);

    const newArticleRow = page.locator('div, li, tr').filter({ hasText: newArticleName }).last();
    await newArticleRow.waitFor({ state: 'visible', timeout: 10000 });

    console.log(`  - 記事の行をクリックして右サイドバーを開きます。`);
    await newArticleRow.click();
    await page.waitForTimeout(2000);

    console.log(`  - サイドバー内のコピーアイコンをクリックします。`);
    try {
        const copyBtnContainer = page.locator('*:has-text("配信URL")').locator('..').last();
        await copyBtnContainer.locator('svg').first().click();
    } catch(e) {
        await page.locator('[data-testid="FileCopyIcon"]').first().click();
    }
    await page.waitForTimeout(1000);

    const copiedUrl = await page.evaluate(() => navigator.clipboard.readText());
    console.log(`  => 🎉 取得したURL: ${copiedUrl}`);

    if (gasUrl) {
      await axios.post(gasUrl, { row_idx: rowIdx, entry_url: copiedUrl, status: 'success', task_type: 'duplicate' });
    }

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
