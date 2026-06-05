# beyond-automation

## このリポジトリの目的

**squadbeyond.com 上の操作をPlaywright（Node.js）で自動化するRPA。**  
Google広告のアフィリエイト記事を量産するために、手動では時間のかかるページ複製・フォルダ作成をコード化している。

---

## 全体の仕組み

```
Googleスプレッドシート（管理表）
        ↓ 5分ごとに自動チェック（GAS / rpaOrchestrator）
        ↓ 「待機中」の行を検出
        ↓ GitHub Actions をキック（repository_dispatch）
GitHub Actions（このリポジトリ）
        ↓ Playwright でブラウザを起動
        ↓ squadbeyond.com を自動操作
        ↓ 完了したら GAS の doPost に結果をPOST
Googleスプレッドシート
        ↓ 「完了」に更新 ＋ Chatworkに通知
```

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `task.js` | **記事作成RPA**（メイン）。フォルダ作成→記事複製を実行 |
| `task_old.js` | task.js の旧バージョン（旧UIに対応）。ロールバック用バックアップ |
| `duplicate_page_task.js` | **ページ複製RPA**（サブ）。beyondページを別フォルダへ複製するだけ |
| `.github/workflows/run_rpa.yml` | task.js を動かすGitHub Actionsワークフロー |
| `.github/workflows/run_duplicate_page.yml` | duplicate_page_task.js を動かすGitHub Actionsワークフロー |
| `BUGLOG.md` | UIが変わったときのエラー記録と修正履歴 |

---

## task.js の処理フロー（記事作成RPA）

```
[Step 1]   ログイン → ログアウト → 再ログイン（システムバグ回避）
              ↓
[Step 1.3] チーム「フルアウト」を選択
              ↓
[Step 1.5] 「ページ」メニューをクリックしてページ一覧へ
              ↓
[Step 2]   コピー先フォルダを新規作成
             - 独自ドメインを選択
             - ドメインを入力・選択
             - グループ（GROUP_LIST_NAME_DEST）を選択
             - 「作成する」でフォルダ作成
              ↓
[Step 2.5] 作成したフォルダを正式名称（FOLDER_NAME_DEST）にリネーム
             - サイドバーで GROUP_LIST_NAME_DEST を検索
             - 最初のフォルダ → 「名称変更」で FOLDER_NAME_DEST に変更
              ↓
[Step 3]   コピー元フォルダを検索
             - サイドバーで GROUP_LIST_NAME_SOURCE を検索
             - FOLDER_NAME_SOURCE をクリックして開く
              ↓
[Step 4]   フォルダ内で SOURCE_ARTICLE を検索（フォルダ内検索）
              ↓
[Step 5]   記事の「...」メニュー → 「別フォルダへ複製」をクリック
              ↓
[Step 6]   複製ダイアログを設定
             - 複製先チーム：現在のチーム内
             - 複製先フォルダ：GROUP_LIST_NAME_DEST → FOLDER_NAME_DEST
             - 配信URL：DELIVERY_URL
             - 「設定確認」→「この内容でページを複製する」
              ↓
        GAS の doPost に成功/失敗をPOST
```

---

## 環境変数（GitHub Secrets）

| 変数名 | 内容 |
|---|---|
| `SQUADBEYOND_ID` | ログインID（メールアドレス） |
| `SQUADBEYOND_PASS` | ログインパスワード |
| `GAS_WEBAPP_URL` | 完了通知先のGAS WebアプリURL |
| `GITHUB_TOKEN` | ※GASから自動注入。変更不要 |

---

## GASとの連携（スプレッドシート側）

- **管理スプレッドシート**：`1Vq3DF5IaRx4gFmmUQarss-LwwO-Km56XQSk5k79RHd8`
- **GASリポジトリ**：`C:\Users\kimurashuhei\gas-projects\fullout\affiliate-pipeline`
- GASの `rpaOrchestrator()` が5分ごとに「待機中」行を検出して Actions をキック
- Actions 完了後、GASの `doPost()` がシートに結果書き戻し + Chatwork通知

---

## UIが変わったときの対応手順

1. Chrome DevTools の **Recorder** パネルで新UIの操作を録画
2. **「Export → JSON」** でファイルを保存
3. そのJSONをClaudeに渡す
4. Claudeが `task.js` を自動修正して GitHub にプッシュ

> エラーが出た場合は「エラー取得して修正して」とClaudeに伝えるだけで、
> GitHub Actionsのログを自動取得して修正・プッシュまで対応する。

---

## ロールバック方法

`task_old.js` の中身を `task.js` にコピーして push するだけ。

```bash
cp task_old.js task.js
git add task.js
git commit -m "revert: rollback to old UI version"
git push origin main
```
