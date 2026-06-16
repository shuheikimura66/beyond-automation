# Bug Fix Log — beyond-automation / task.js

## 背景
squadbeyond.com のUIが変更されたため、task.js のセレクターを新UIに対応させる作業。
旧コードは `task_old.js` としてバックアップ済み。

---

## [2026-06-16] #009 — `duplicate_page_task.js` の「beyondページ複製」クリックタイムアウト

**エラー内容**
```
locator.click: Timeout 30000ms exceeded.
  - waiting for getByText('beyondページ複製', { exact: true }).last()
  - locator resolved to <span class="css-1xdhyk6 e1u6usw30">beyondページ複製</span>
  - waiting for element to be visible, enabled and stable
```

**原因**
`[data-testid="option-icon"]` クリック後の待機が500msと短く、ドロップダウンメニューのアニメーション完了前にクリックしようとしていた。要素は存在するが `visible/stable` 状態になっておらず30秒タイムアウト。

**修正**
- option-icon クリック後の待機を 500ms → 1000ms に延長
- `beyondページ複製` クリック前に `waitFor({ state: 'visible', timeout: 10000 })` を追加して確実にメニューが表示されてからクリック

---

## [2026-06-05] #001 — `getByText('独自ドメイン')` の strict mode violation

**エラー内容**
```
locator.click: Error: strict mode violation: getByText('独自ドメイン') resolved to 3 elements
  1) <label>独自ドメイン</label>
  2) <span>独自ドメインを選択する</span>
  3) <div>独自ドメインを利用すると...</div>
```

**原因**
`getByText('独自ドメイン')` がサブストリングマッチで3要素にヒットした。

**修正**
`getByText('独自ドメイン', { exact: true })` に変更。

---

## [2026-06-05] #002 — `div.css-e0dnmk button` の strict mode violation

**エラー内容**
```
locator.click: Error: strict mode violation: locator('div.css-e0dnmk button') resolved to 2 elements
  1) combobox "独自ドメインを選択する"
  2) combobox "既存ドメインを選択する"
```

**原因**
`div.css-e0dnmk button` が2つのcomboboxにマッチ。旧UIの「次へ」ボタンと誤認していた。

**修正**
`getByRole('combobox').filter({ hasText: '独自ドメインを選択する' })` に変更。

---

## [2026-06-05] #003 — combobox `disabled` のまま30秒タイムアウト

**エラー内容**
```
locator.click: Timeout 30000ms exceeded.
- element is not enabled (data-disabled="")
- waiting for getByRole('combobox').filter({ hasText: '独自ドメインを選択する' })
```

**原因**
「独自ドメイン」ラジオを2回クリックしていた（`section label` → `getByText`）ため、ON→OFFと打ち消されcomboboxが無効のまま。

**修正**
最初の `section label` クリックを削除し、`getByText('独自ドメイン', { exact: true })` の1回クリックに統一。combobox に `waitFor({ state: 'visible' })` を追加。

---

## [2026-06-05] #004 — `div.css-1vn620w` がmodal-overlayに遮蔽されクリック不可

**エラー内容**
```
locator.click: Timeout 30000ms exceeded.
- <div data-testid="modal-overlay"> intercepts pointer events
- waiting for locator('div.css-1vn620w')
```

**原因**
`div.css-1vn620w` はドメイン選択肢ではなく**グループ選択トリガーボタン**だった。ドメインのcomboboxドロップダウンが開いたままの状態でクリックしようとしていた。

**修正**
- ドメイン入力後 → `page.getByText(domain, { exact: true }).last().click()` でドロップダウンから選択して確定
- `div.css-1vn620w` → force なしでグループトリガーとしてクリック
- グループinputに `waitFor({ state: 'visible' })` を追加

---

## [2026-06-05] #005 — グループ入力 `locator('input').last()` がタイムアウト

**エラー内容**
```
locator.click: Timeout 30000ms exceeded.
- waiting for locator('input').last()
```

**原因**
`div.css-1vn620w` はグループポップオーバーを開くトリガー。クリック後にinputが現れるまで待機が不足していた。

**修正**
`groupInput.waitFor({ state: 'visible', timeout: 5000 })` を追加。

---

## [2026-06-05] #006 — Step 2.5 サイドバー検索input が見つからない（第1報）

**エラー内容**
```
locator.click: Timeout 30000ms exceeded.
- waiting for locator('[data-testid="side-menu"] input').first()
- waiting for locator('div.css-bh9ql4 input').first()  ← フォールバックも失敗
```

**原因**
フォルダ作成後、ページが別ビューに遷移しており、サイドバー検索が存在しない状態だった。

**修正（暫定）**
ページメニューを再クリックして一覧ビューに戻す処理を追加。`div.css-bh9ql4 input` の `waitFor` でinput出現を待機。

---

## [2026-06-05] #008 — Step 1.5 `[data-testid="list-menu-item"] nth(2)` タイムアウト

**エラー内容**
```
locator.click: Timeout 30000ms exceeded.
- waiting for locator('[data-testid="list-menu-item"]').nth(2)
```

**原因**
Step 1.2 でログイン画面が表示されなかったケースで、フルアウト選択後にページが不完全な状態のまま。
ナビゲーションアイテムが3つ揃う前にクリックしようとしてタイムアウト。

**修正**
- `waitForLoadState('networkidle')` で通信が落ち着くまで待機
- `nth(2).waitFor({ state: 'visible', timeout: 20000 })` でクリック前に要素の出現を明示的に確認

---

## [2026-06-05] #007 — Step 2.5 サイドバー検索input が見つからない（第2報）

**エラー内容**
```
locator.waitFor: Timeout 10000ms exceeded.
- waiting for locator('div.css-bh9ql4 input').first() to be visible
```

**原因**
サイドバーの検索inputは**検索トグルボタンを押すまで非表示**になっている。
ページ一覧ビューに戻るだけでは不十分で、検索アイコンをクリックしてinputを表示させる必要があった。
旧コードの `div.efy50tl7` クリックはCSSクラス変更で無効化されており、`.catch(() => {})` で無音スキップされていた。

**修正**
3段階フォールバックで検索トグルをクリック：
1. xpath構造でトグルアイコンをクリック（`//*[@id="root"]/div[2]/div/div[2]/div/div[2]/div/div[1]/div[2]`）
2. 生成クラス名 `div.efy50tl7` でクリック
3. `[data-testid="side-menu"] button` を最大5個順にクリック
いずれかでinputが現れたら処理を続行。

---

## [2026-06-07] #009 — Step 2.5 サイドバー検索input が見つからない（第3報・3段階フォールバックも失敗）

**エラー内容**
```
locator.waitFor: Timeout 8000ms exceeded.
  - waiting for locator('[data-testid="side-menu"] input').first() to be visible
    at task.js:217
```

**原因**
#007 で追加した3段階フォールバック（XPath / `div.efy50tl7` / `[data-testid="side-menu"] button` 列挙）が全て失敗。
UIの再変更でXPathもクラス名も無効になり、button列挙もsearchInputを表示できなかった。
一方、Step 3 では `div.css-bh9ql4 input` をトグルなしで直接取得しており、こちらは問題なく動作する（Step 2.5失敗で到達できていないが構造的に正しい）。

**修正**
Step 2.5 のトグル起動ロジックを全廃し、Step 3 と同じセレクター `div.css-bh9ql4 input` で直接 `waitFor` → `click` → `fill` に変更。

---

## [2026-06-07] #010 — `div.css-bh9ql4 input` も存在せずStep 2.5/3 ともにタイムアウト

**エラー内容**
```
locator.waitFor: Timeout 10000ms exceeded.
  - waiting for locator('div.css-bh9ql4 input').first() to be visible
    at task.js:191
```

**原因**
`div.css-bh9ql4 input` もUIリニューアルで消滅。サイドバーに検索inputが存在しない新UIになった。
Step 3 も同じセレクターを使用しており、Step 2.5 が失敗するため Step 3 には到達できていなかったが同様に失敗する状態だった。

**修正**
Step 2.5・Step 3 ともにサイドバー検索を完全廃止。
- Step 2.5: `groupListDest` グループを `filter({ hasText })` で展開 → `新しいフォルダ` を直接 hover して3ドットボタン → 名称変更
- Step 3: `groupListSource` を `filter({ hasText })` で直接クリックして展開（検索なし）

---

## [2026-06-07] #011 — Step 2.5 サイドバーグループクリックがインターセプトされてタイムアウト

**エラー内容**
```
locator.click: Timeout 30000ms exceeded.
  - locator resolved to <div data-testid="list-menu-item" ...>
  - element is visible, enabled and stable
  - scrolling into view if needed
  （スクロール後に別要素がポインターをインターセプト）
```

**原因**
サイドバーの `[data-testid="list-menu-item"]` は要素として存在・表示されているが、スクロール後に別のオーバーレイ要素がクリックをインターセプトするためタイムアウト。

**修正**
サイドバー経由の操作を廃止し、トップバー検索 `input[placeholder="ページ/ドメイン/URLで検索"]` に「新しいフォルダ」を入力して検索結果から直接 hover → 3ドット → 名称変更に変更。

---

## [2026-06-07] #012 — トップバー検索inputが存在しない（Timeout 10000ms）

**エラー内容**
```
locator.waitFor: Timeout 10000ms exceeded.
  - waiting for locator('input[placeholder="ページ/ドメイン/URLで検索"]').first() to be visible
    at task.js:191
```

**原因**
ページ一覧ビューに戻った後、`input[placeholder="ページ/ドメイン/URLで検索"]` が自動的には表示されない状態。
一方、ページ一覧ビューのメインコンテンツには「新しいフォルダ」が既に表示されており、検索は不要だった。

**修正**
検索を完全に廃止。`page.getByText('新しいフォルダ', { exact: true })` を直接右クリックしてコンテキストメニュー「名称変更」を呼び出す方式に変更。

---

## [2026-06-07] #013 — 右クリックが機能しない、Chrome DevTools Recorder録画で正しい操作パスを特定

**エラー内容**
右クリックでコンテキストメニューが出ない（UIが右クリック非対応）。

**原因・調査**
Chrome DevTools Recorderで実際の操作を録画した結果（beyond.json）、正しい操作フローが判明：
1. `page.goto('https://app.squadbeyond.com/folders')` で直接移動
2. 検索inputは `[data-testid="side-menu"]/div[1]/div[1]/div/div/label/input`（label内にラップされていた）
3. 「新しいフォルダ」を入力 → Enter
4. 3ドットボタンは `[data-testid="list-menu-item"]/div[3]/div/div[2]/button`
5. 「名称変更」をクリック

**修正**
- ページ戻りをクリック操作から `page.goto('/folders')` に変更（安定性向上）
- side-menu検索inputをRecorder録画のXPathで直接指定
- 3ドットボタンもRecorder録画のXPathで直接指定

---

## [2026-06-07] #014 — /folders 遷移後、side-menu XPath inputが見つからない

**エラー内容**
```
locator.waitFor: Timeout 10000ms exceeded.
  - waiting for locator('//*[@data-testid="side-menu"]/div[1]/div[1]/div/div/label/input') to be visible
```

**原因**
録画（beyond.json）は検索パネルが既に開いた状態から始まっていた。
実際の /folders 画面では左上に「検索」ボタンがあり、クリックするとパネルが開いてinputが現れる。
自動化ではそのクリックが抜けていたため、inputが存在しない状態だった。

**修正**
`page.getByRole('button', { name: /^検索$/ })` で検索ボタンを押してパネルを開いてから、XPath inputを使用。

---

## [2026-06-07] #015 — Step 3 `原本グループ` の list-menu-item クリックがタイムアウト

**エラー内容**
```
locator.click: Timeout 30000ms exceeded.
  - waiting for locator('[data-testid="list-menu-item"]').filter({ hasText: '原本グループ' }).first()
    at task.js:227
```

**原因**
Step 2.5が /folders の検索パネルで完了した後、Step 3が同じ /folders ビューでサイドバーの `原本グループ` を直接クリックしようとしているが、検索パネルを閉じた後の通常サイドバーでは `list-menu-item` がクリックできない（インターセプト or 要素未表示）。

**修正**
Step 3も検索パネル方式に統一。`groupListSource → sourceFolder` の階層クリックを廃止し、`sourceFolder` を検索パネルで直接検索してクリックする方式に変更。検索パネルが閉じている場合は再度 `getByRole('button', 検索)` で開く。

---

## [2026-06-07] #016 — Step 5 `button.css-16dhtfm` タイムアウト / Step 6 フォルダクリック生成クラス

**エラー内容**
```
locator.click: Timeout 30000ms exceeded.
  - waiting for locator('button.css-16dhtfm')
    at task.js:262
```

**原因**
Step 5の `button.css-16dhtfm`（生成クラス）がUI変更で無効化。
Step 6のフォルダクリック `div.css-d3v9zr div.css-79rqsy` も同様に生成クラスで不安定。

**修正（Chrome DevTools Recorder 録画 0607_1.json から取得）**
- Step 5: `button.css-16dhtfm` → `[data-testid="option-icon"]`（data-testid属性で安定）
- Step 6 フォルダクリック: `div.css-d3v9zr div.css-79rqsy` → `[data-testid="list-menu-item"].filter(destFolder) > div:nth-of-type(2)`

---

## [2026-06-07] #017 — Step 5 `[data-testid="option-icon"]` が表示されずタイムアウト

**エラー内容**
エラーログ取得不可（ネットワーク障害）。スクリーンショットから `option-icon` が記事行に表示されていない状態を確認。

**原因**
`[data-testid="option-icon"]` は記事行をホバーするまでDOMに存在しない（または `display: none`）hover-to-reveal型のUI。
ホバーなしに `locator.click()` を呼んでも要素が見つからずタイムアウト。

**修正**
`page.locator('[data-testid="option-icon"]').first().click()` の前に、記事テキストへの `.hover()` を追加：
```js
const articleItem = page.getByText(sourceArticle, { exact: true }).first();
await articleItem.waitFor({ state: 'visible', timeout: 10000 });
await articleItem.hover();
await page.waitForTimeout(500);
await page.locator('[data-testid="option-icon"]').first().click();
```

---

## [2026-06-07] #018 — duplicate_page_task.js：配信URL未入力 → 設定確認が無効 → エラー

**対象ファイル**
`duplicate_page_task.js`

**エラー内容**
ダイアログの「設定確認」ボタンがグレーで無効状態のまま処理が止まる。手動では正常動作。

**原因**
2点の複合要因：
1. **配信URLタブを明示的に開いていなかった** → ヘッドレスブラウザではデフォルトでURLタブが開いていない場合があり、`isVisible()` チェックで URL input が見つからずスキップされた。
2. **`設定確認` クリックが録画に存在しない** → `beyondページ複製` ダイアログは `設定確認` を経由せず直接「この内容でページを複製する」へ進む設計。コードに不要な `設定確認` クリックが含まれていた（URLが未入力のため無効ボタン状態になりエラー）。

**修正（録画 0607_10.json 確認）**
- `getByText('配信URL').click()` で配信URLタブを明示的に開いてから入力
- `isVisible()` ガードを `waitFor({ state: 'visible' })` に変更（サイレントスキップを防止）
- `設定確認` ステップを削除 → `この内容でページを複製する` を直接クリック

```js
// 配信URLタブを明示的に開く
await page.getByText('配信URL').first().click();
await page.waitForTimeout(500);
// URL入力
const urlInput = activeModal.locator('section:nth-of-type(3) input').first();
await urlInput.waitFor({ state: 'visible', timeout: 5000 });
await urlInput.fill(deliveryUrl);
// ページ名タブへ切り替え
await page.getByText('いつでも変更可能です').last().click();
// 複製実行（設定確認なし）
await page.getByText('この内容でページを複製する', { exact: true }).last().click();
```

---

## [2026-06-07] #019 — task.js：配信URL未入力（isVisible スキップ） / ページ名blur欠落

**対象ファイル**
`task.js`

**エラー内容**
スクリーンショットで配信URL欄が空のまま。設定確認ボタンは有効（青）だが入力値なし。
手動では正常動作。録画（新 0607_1.json）を参照。

**原因**
1. `if (await urlInput.isVisible().catch(() => false))` でURL inputの検出が false になりサイレントスキップ。
2. URL入力後にblur処理がなく、UIがバリデーションを確定しない可能性。
3. ページ名accordion → 入力フローが task.js に存在しなかった（録画では操作あり）。

**修正**
- `isVisible()` → `waitFor({ state: 'visible', timeout: 5000 })` に変更
- URL fill後に `page.keyboard.press('Tab')` でblur（録画の `div.css-1ks2dpx` クリック相当）
- ページ名accordionを開く処理を追加（task.js は newArticleName なしのため名前入力はスキップ）

```js
const urlInput = activeModal.locator('section:nth-of-type(3) input').first();
await urlInput.waitFor({ state: 'visible', timeout: 5000 });
await urlInput.click();
await urlInput.fill(deliveryUrl);
await page.keyboard.press('Tab'); // blur
```

---

## [2026-06-07] #020 — duplicate_page_task.js：配信URLタブが開かない（Radix UIトリガー誤認）

**対象ファイル**
`duplicate_page_task.js`

**エラー内容**
配信URL入力欄が空白のまま複製実行。URLが設定されない。

**原因**
1. `getByText('配信URL').click()` はRadix UIのaccordion **コンテンツ**テキストにマッチするが、実際のトリガー要素は `<span class="css-1y4djjq ei7abna4">⚠️後から変更できません</span>` というspanタグ。
2. 録画 `1.json` の selector: `#radix-:r19n:-trigger-url > span` と `text/⚠️後から変更できません`。
3. `設定確認` クリックが誤って削除されていた（beyondページ複製でも必要）。

**修正**
- `getByText('配信URL')` → `getByText('⚠️後から変更できません')` に変更
- `設定確認` クリックを復元
- destFolderクリックに `.locator('div:nth-of-type(2)')` → `.locator('xpath=div[2]')` を適用（予防的）

```js
await page.getByText('⚠️後から変更できません').click();
```

---

## [2026-06-07] #021 — duplicate_page_task.js：Step 6 URL取得でドメイン文字列構築に失敗

**対象ファイル**
`duplicate_page_task.js`

**エラー内容**
Step 6でのURL取得処理がエラー終了。ドメイン文字列からURLを組み立てる方式が不安定。

**原因**
`destFolder` の文字列からドメインを正規表現で抽出してURL構築しようとしたが、フォルダ名の命名規則によっては抽出できないケースがある。

**修正**
UIフローでURLを直接取得する方式に変更。
- `/folders` 画面で検索 → フォルダクリック → 記事クリック → コピーボタン → clipboard API

```js
await page.getByRole('button', { name: 'コピー' }).first().click();
const finalUrl = await page.evaluate(() => navigator.clipboard.readText());
```

---

## [2026-06-07] #022 — duplicate_page_task.js：Step 6 検索でEnterを押すとフォルダ内容が空になる

**対象ファイル**
`duplicate_page_task.js`

**エラー内容**
Step 6でdestFolderを検索後、フォルダをクリックしても記事が表示されない。

**原因**
サイドメニュー検索でEnterキーを押すとフォルダの**中身をフィルタ**する挙動になり、記事一覧が空になる。
Step 2（sourceFolder検索）はEnterが必要だが、Step 6はchange event（入力のみ）で検索結果が自動表示される。

**修正**
Step 6の検索でEnterキー押下を削除。2秒待機のみで結果を待つ。

```js
await sideInputForUrl.fill(destFolder);
await page.waitForTimeout(2000); // Enterなし
```

---

## [2026-06-07] #023 — duplicate_page_task.js：Step 6 destFolderクリックで strict mode violation

**対象ファイル**
`duplicate_page_task.js`

**エラーログ（GitHub Actions 実行 #27088055735）**
```
locator.click: Error: strict mode violation:
  locator('[data-testid="list-menu-item"]').filter({ hasText: '【Google広告】リリィジュ木村_07（perfectskinmagic.site）' }).first().locator('div:nth-of-type(2)')
  resolved to 2 elements:
    1) <div class="css-79rqsy e1n71b3p3">【Google広告】リリィジュ木村_07...
    2) <div type="button" data-state="closed" aria-expanded="false" aria-haspopup="dialog" ...>
  at duplicate_page_task.js:264
```

**原因**
CSS の `div:nth-of-type(2)` は **descendant selector** のため、`list-menu-item` 内のサブツリー全体の「2番目div」に全てマッチする。
- depth 1: `<div class="css-79rqsy">` ← 目的の要素
- depth 2: `<div type="button">` ← ネストされた2番目div も一致

**修正**
`div:nth-of-type(2)` → `xpath=div[2]` に変更。
XPathの `div[2]` は「直接の子の2番目div」のみを対象にするため、サブツリー内の要素はマッチしない。

同パターンが2箇所（Step 5 line 190、Step 6 line 264）に存在。両方を修正。

```js
// Before（broken）:
.locator('div:nth-of-type(2)').click();

// After（fixed）:
.locator('xpath=div[2]').click();
```

Steps 1〜5 は全て正常完了。エラーはStep 6のみ。
