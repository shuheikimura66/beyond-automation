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
    await searchInput.fill('木村_260410');
    
    // 検索結果が読み込まれるまで少し待つ（必要に応じて）
    await page.waitForLoadState('networkidle');

// ② 「グループ名」の右側にあるメニューボタン（三点リーダー）をクリック
    console.log(`グループ名「${groupName}」のメニューボタンを探しています...`);

    // 1. まず、スプレッドシートのC列（groupName）と同じテキストを持つ要素を探す
    // 2. その親要素を辿って、その中にある「button」を探す
    // これにより、他の行のボタンと間違えずに特定できます
    const menuButton = page.locator(`div:has-text("${groupName}")`).locator('button').last();

    // ボタンが見えるまでスクロールしてクリック
    await menuButton.scrollIntoViewIfNeeded();
    await menuButton.click();

    console.log("メニューボタンをクリックしました。");

    // メニューが表示されるまで少し待機
    await page.waitForTimeout(1000);

// ③ メニューの中から「フォルダ作成」をクリック
    console.log("「フォルダ作成」ボタンをクリックします...");
    
    // 画面全体から探すのではなく、現在表示されているメニュー（role="menu" や popover）を優先
    // 「フォルダ作成」というテキストが含まれるボタンを特定してクリック
    const createFolderButton = page.getByRole('button', { name: 'フォルダ作成' });
    
    // クリック可能になるまで待機してから実行
    await createFolderButton.waitFor({ state: 'visible' });
    await createFolderButton.click();

    console.log("フォルダ作成画面が開くのを待っています...");
    // 画面が切り替わるか、入力欄が出るまで少し待機
    await page.waitForLoadState('networkidle');

// ④ フォルダ名の入力（F列：accountName）
    console.log(`フォルダ名に入力中: ${accountName}`);
    // placeholderが空なので、input要素のタイプ（text）と必須（required）属性を組み合わせて特定
    await page.locator('input[type="text"][required]').fill(accountName);

// ⑤ 認証済み独自ドメインの選択（B列：domain）
    console.log(`ドメインを選択中: ${domain}`);
    // 「認証済み独自ドメイン」というラベルが付いているセレクトボックスをクリック
    await page.getByLabel('認証済み独自ドメイン').click();
    
    // プルダウンの選択肢（リスト）が表示されるので、スプシのB列のドメイン名と一致するものをクリック
    // SquadBeyondのプルダウンはMui-Popover形式が多いので、画面全体からテキストで探します
    await page.getByRole('option', { name: domain }).click();

// ⑥ 「作成する」ボタンをクリック
    console.log("「作成する」ボタンをクリックして確定します...");
    const submitButton = page.getByRole('button', { name: '作成する' });
    
    // ボタンがクリック可能（ローディング中でない）ことを確認してクリック
    await submitButton.click();

    // フォルダ作成後の画面遷移または完了を待機
    await page.waitForLoadState('networkidle');
    console.log("フォルダの作成が完了しました。");

 // ①〜② スプシのK列(searchKeyword)を検索窓に入力
    console.log(`K列のキーワードで検索中: ${searchKeyword}`);
    const topSearchInput = page.locator('input[type="search"]').first();
    await topSearchInput.fill(searchKeyword);
    await page.waitForTimeout(1000); // 検索結果の反映待ち

 // ③ 「原本グループ」をクリック
    console.log("原本グループを選択します");
    await page.getByText('原本グループ').click();

 // ④〜⑤ スプシのL列(targetArticle)を記事検索窓に入力
    // 画面中央右側の検索窓（画像から推測）に入力
    console.log(`L列の記事名を検索中: ${targetArticle}`);
    await page.getByPlaceholder('媒体/名前検索').fill(targetArticle);
    await page.waitForTimeout(1000);

 // ⑥ 検索して出てきた文字列の右側にある「：」ボタンを押す
    console.log(`${targetArticle} のメニューボタンを探しています...`);
    // 文字列(targetArticle)が含まれる行(div)を特定し、その中にある最後のbuttonをクリック
    const articleMenu = page.locator(`div:has-text("${targetArticle}")`).locator('button').last();
    await articleMenu.click();

  // ⑦ 「別フォルダへ複製」をクリック
    await page.getByText('別フォルダへ複製').click();

  // ⑧ beyondページ名を入力（targetArticleをそのまま入力）
    console.log("複製後のページ名を入力中...");
    await page.locator('input[type="text"].MuiFilledInput-input').first().fill(targetArticle);

  // ⑨ 「チーム」で「フルアウト」を選択
    await page.getByRole('button', { name: /​/ }).click(); // Selectの空文字スパン対策
    await page.getByRole('option', { name: 'フルアウト' }).click();

  // ⑩ 「フォルダ」で⑥（ステップ④〜⑥）で作成したフォルダ名を選択
    console.log(`フォルダ「${accountName}」を選択します`);
    const folderInput = page.locator('input[role="combobox"]');
    await folderInput.fill(accountName);
    await page.getByRole('option', { name: accountName }).click();

  // ⑪ 「複製する」ボタンをクリック
    console.log("「複製する」をクリックして確定します");
    await page.getByRole('button', { name: '複製する' }).click();

    // 完了待機
    await page.waitForLoadState('networkidle');

// ==========================================
    // 5. 複製された記事のURL取得とステータス更新
    // ==========================================

// ① 入力画面で先ほど作成したフォルダ名(accountName)を入力
    console.log(`作成したフォルダ「${accountName}」を検索中...`);
    const finalSearchInput = page.locator('input[type="search"]').first();
    await finalSearchInput.fill(accountName);
    await page.waitForTimeout(1000);

 // ② 作成したフォルダ名を選択（テキスト一致でクリック）
    console.log("フォルダを選択します");
    await page.getByText(accountName, { exact: true }).click();
    await page.waitForLoadState('networkidle');

 // ③ 複製した「beyondページ名」(targetArticle)のメニュー「：」をクリック
    console.log(`${targetArticle} のメニューを開きます`);
    const resultArticleMenu = page.locator(`div:has-text("${targetArticle}")`).locator('button').last();
    await resultArticleMenu.click();

 // ③-2 URLコピーボタン（FileCopyIcon）を探して、そのURLを抽出する
    // 直接コピーボタンを押すのではなく、そのボタンに紐づくリンクや属性を取得するのが確実です
    console.log("入稿用URLを取得しています...");
    
    // SquadBeyondの仕様に合わせて調整：コピーアイコンの親要素や、付近にあるリンクを取得
    // ここでは、データ属性やリンクが含まれている「a要素」や「input要素」を探します
    const urlElement = page.locator('data-testid="FileCopyIcon"').locator('xpath=..'); // アイコンの親を取得
    
    // もしクリップボードコピーが必須な場合、あるいは単純に画面上のURLテキストを拾う場合：
    const entryUrl = await page.evaluate(() => {
        // ここは実際のDOM構造により調整が必要ですが、多くの場合 hidden input等にURLがあります
        // 一旦、現在開いているページのURLや特定のセレクタから取得する例
        return document.querySelector('input[readonly]') ? document.querySelector('input[readonly]').value : location.href;
    });

    console.log(`取得成功: ${entryUrl}`);

    // ④〜⑤ GASへ結果を送信（スプシのM列にURL格納、J列を完了へ）
    // この後、GAS側に「受け取り用URL」を作る必要があります。

    
// --- 正常終了の報告 ---
    const gasUrl = process.env.GAS_WEBAPP_URL;
    if (gasUrl) {
      const axios = require('axios');
      await axios.post(gasUrl, {
        row_idx: process.env.ROW_IDX,
        entry_url: entryUrl, // 取得したURL
        status: 'success'
      });
      console.log("GASへの成功報告が完了しました。");
    }

  } catch (error) {
    console.error("エラーが発生しました:", error);
    
    // --- エラー発生の報告 ---
    const gasUrl = process.env.GAS_WEBAPP_URL;
    if (gasUrl) {
      const axios = require('axios');
      await axios.post(gasUrl, {
        row_idx: process.env.ROW_IDX,
        entry_url: "", 
        status: 'error' // GAS側でJ列を「エラー」にするトリガーになります
      });
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
