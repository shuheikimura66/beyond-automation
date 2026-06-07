# Bug Fix Log — beyond-automation / task.js

## 背景
squadbeyond.com のUIが変更されたため、task.js のセレクターを新UIに対応させる作業。
旧コードは `task_old.js` としてバックアップ済み。

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
