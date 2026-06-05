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

## [2026-06-05] #006 — Step 2.5 サイドバー検索input `[data-testid="side-menu"] input` が見つからない

**エラー内容**
```
locator.click: Timeout 30000ms exceeded.
- waiting for locator('[data-testid="side-menu"] input').first()
- waiting for locator('div.css-bh9ql4 input').first()  ← フォールバックも失敗
```

**原因**
フォルダ作成後、ページが別ビュー（作成確認画面など）に遷移しており、サイドバー検索が存在しない状態だった。
`div.efy50tl7` のクリックが `.catch(() => {})` で無音スキップされ、サイドバーのsearchが有効化されなかった。

**修正**
ページメニューアイコン（`[data-testid="list-menu-item"] nth(2)`）を再クリックしてページ一覧ビューに確実に戻る処理を追加。その後 `div.css-bh9ql4 input` の `waitFor` でinput出現を待機。
