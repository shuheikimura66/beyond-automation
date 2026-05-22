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

    // =========================================================
    // [Step 1] 強制ログアウトリセット → フルアウト選択
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
        const fulloutDiv = page.locator('div').filter({ hasText: /^フルアウト$/ }).last();
        await fulloutDiv.click();
        console.log(`  => ✅ フルアウト選択完了`);
        await page.waitForTimeout(5000);
        await page.waitForLoadState('load');
    } catch(e) {
        console.log(`  => ⚠️ フルアウト選択スキップ（自動遷移した可能性があります）`);
    }

    // =========================================================
    // [Step 1.2] 新旧デザインの確認と切り替え
    // =========================================================
    console.log(`\n[Step 1.4] UIデザインの確認を行います。`);
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
    // [Step 3] 新UIでの記事検索
    // =========================================================
    console.log(`\n[Step 3] フォルダ内で記事「${sourceArticle}」を検索します。`);
    
    console.log(`  - 「フォルダ内検索」ボタンをクリックします。`);
    const folderSearchBtn = page.getByText('フォルダ内検索', { exact: true }).first();
    if (await folderSearchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await folderSearchBtn.click();
        await page.waitForTimeout(1000);
    }

    console.log(`  - 検索窓に記事名を入力します。`);
    const folderSearchInput = page.locator('input[placeholder*="内を検索"]').first();
    if (await folderSearchInput.isVisible().catch(() => false)) {
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
    // [Step 4] メニューを開き「複製」を選択
    // =========================================================
    console.log(`\n[Step 4] 対象記事のメニューを開きます。`);
    const targetArticleText = page.getByText(sourceArticle).filter({ state: 'visible' }).first();
    await targetArticleText.scrollIntoViewIfNeeded().catch(() => {});
    await targetArticleText.hover({ force: true });
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

    if (isSameFolder) {
        console.log(`  => 【パターンA】同じフォルダ内なので「beyondページ複製」を選択します。`);
        await page.getByText('beyondページ複製', { exact: true }).last().click();
    } else {
        console.log(`  => 【パターンB】別フォルダへ移動するため「別フォルダへ複製」を選択します。`);
        await page.getByText('別フォルダへ複製', { exact: true }).last().click();
    }
    await page.waitForTimeout(3000);

    // =========================================================
    // [Step 5] 複製設定の入力（新UI単一モーダル対応）
    // =========================================================
    console.log(`\n[Step 5] 新規複製ウィザードを進めます（新UI対応）。`);

    const activeModal = page.locator('div[role="dialog"]').last();

    if (!isSameFolder) {
        console.log(`  - 1.複製先チームを「現在のチーム内」に設定します。`);
        const teamDropdownTrigger = activeModal.getByText(/選択してください|現在のチーム内/).first();
        await teamDropdownTrigger.click({ force: true });
        await page.waitForTimeout(1000);
        await page.getByText('現在のチーム内', { exact: true }).last().click();
        await page.waitForTimeout(1000);

        console.log(`  - 2.複製先フォルダを選択します。`);
        const folderDropdownTrigger = activeModal.getByText('フォルダを選択...').first();
        await folderDropdownTrigger.click({ force: true });
        await page.waitForTimeout(1000);

        console.log(`  - 検索窓にフォルダ名「${destFolder}」を入力します。`);
        const modalFolderSearch = page.locator('input[type="text"]').filter({ state: 'visible' }).last();
        await modalFolderSearch.click({ force: true });
        await modalFolderSearch.fill('');
        await modalFolderSearch.pressSequentially(destFolder, { delay: 50 });
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
    }

    console.log(`  - 3.配信URLとページ名を設定します。`);
    if (deliveryUrl) {
        console.log(`    => 配信URLを入力: ${deliveryUrl}`);
        const deliveryInput = activeModal.locator('input[placeholder*="半角英数字"]').last();
        if (await deliveryInput.isVisible().catch(() => false)) {
            await deliveryInput.fill('');
            await deliveryInput.pressSequentially(deliveryUrl, { delay: 50 });
            await page.waitForTimeout(1000);
        }
    }

    console.log(`    => 「ページ名 🙆いつでも変更可能です」タブをクリックします。`);
    try {
        const pageNameTab = activeModal.getByText('いつでも変更可能です').last();
        await pageNameTab.click({ force: true });
        await page.waitForTimeout(1000);
    } catch(e) {
        console.log(`    ⚠️ ページ名タブが見つからないため、そのまま進みます。`);
    }

    console.log(`    => beyondページ名を「${newArticleName}」に変更します。`);
    try {
        const pageNameInput = activeModal.locator('input[type="text"]').filter({ state: 'visible' }).last();
        await pageNameInput.click({ force: true });
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Meta+A'); 
        await page.keyboard.press('Backspace');
        await pageNameInput.pressSequentially(newArticleName, { delay: 50 });
        await page.waitForTimeout(1000);
    } catch(e) {
        console.log(`    ⚠️ ページ名の入力欄が見つかりませんでした。`);
    }

    console.log(`  - 「設定確認」を押します。`);
    const confirmBtn = activeModal.getByText('設定確認', { exact: true }).last();
    try {
        await confirmBtn.evaluate(b => b.click());
    } catch (e) {
        await confirmBtn.click({ force: true });
    }
    await page.waitForTimeout(2000);

    console.log(`  - 「この内容でページを複製する」をクリックします。`);
    const finalCopyBtn = page.getByText('この内容でページを複製する', { exact: true }).last();
    await finalCopyBtn.waitFor({ state: 'attached', timeout: 5000 }).catch(()=>{}); 
    try {
        await finalCopyBtn.evaluate(b => b.click());
    } catch (e) {
        await finalCopyBtn.click({ force: true });
    }
    
    // =========================================================
    // ★大改修: [Step 6] 複製完了待機とURL自動生成
    // =========================================================
    console.log(`  => ⏳ 複製処理の完了を待機しています... (10秒)`);
    // UIが変わってポップアップが出ないため、強制的に10秒待機して完了とみなす
    await page.waitForTimeout(10000); 

    console.log(`\n[Step 7] 入稿用URLの生成を行います。`);
    // スプレッドシートのフォルダ名（destFolder）からドメイン部分（括弧の中身）を抽出する
    // 例: 快調ハニー/G008（shinyskinpower.site） -> shinyskinpower.site
    const domainMatch = destFolder.match(/[（(]([^）)]+)[）)]/);
    let extractedDomain = '';
    
    if (domainMatch && domainMatch[1]) {
        extractedDomain = domainMatch[1].trim();
    } else {
        console.log(`    ⚠️ フォルダ名からドメイン(括弧内の文字列)を抽出できませんでした。`);
    }

    // 抽出したドメインと配信URLを合体させて最終URLを生成
    const finalUrl = extractedDomain ? `https://${extractedDomain}/ab/${deliveryUrl}` : '';
    console.log(`  => 🎉 生成したURL: ${finalUrl}`);

    // GAS（スプレッドシート）に成功ステータスとURLを送信して完了！
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
