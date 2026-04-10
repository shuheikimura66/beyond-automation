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
    

  } catch (error) {
    console.error("エラーが発生しました:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
