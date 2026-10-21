# MPC Discord Camera

カメラ接続を管理するGitHub Pages用の操作画面です。選手の送信リンク発行・接続一覧・Discord ID設定・リンク再発行は、既存のカメラサーバーの管理画面をサイト内に表示して操作します。OBS URLを貼り付けて、映像を確認する機能もあります。

## GitHub Pagesの公開

Settings → Pages → Source「Deploy from a branch」→ Branch「main」・フォルダ「/docs」→ Save。

公開後のURL: https://mpcstaff07.github.io/Discord-System/

このURLは公開設定が完了してから使えます。非公開リポジトリでPagesが使えない契約の場合は、この画面用リポジトリを公開にするか、対応プランが必要です。VoiceONやMavaValoOverlay本体を公開する必要はありません。

## 接続

1. 先に配布したカメラ連携版のサーバーを、外部から接続できるHTTPSで起動します。GitHub Pages上ではPythonサーバーは動きません。
2. このサイトで「カメラサーバーのURL」（例 `https://camera.example.com`）と「管理キー」を入力。
3. 管理キーはサーバー上の `camera_private.json` の `admin` 値です。Discord BotトークンやOAuthのClient Secretではありません。
4. 管理一覧の「送信リンク」を各選手へ渡します。選手はその送信ページでカメラ確認→送信開始。
5. 「OBS URL」をOBSブラウザソースへ貼り付けます。サイト下部の映像確認欄でも確認できます。
6. Discord認証を使う場合は、カメラサーバーでOAuthを設定し、管理画面で選手のDiscord IDを登録します。

参加者・OBSはカメラサーバーへ直接接続します。GitHub Pagesは映像を中継しません。選手宅からの接続は回線によってTURNが必要です。

## サーバー側

先に配布したMavaValoOverlayカメラ連携版の `CAMERA_JA.md` を参照してください。

環境変数 `MAVA_CAMERA_PUBLIC_URL` をHTTPSの接続元に設定し、`/camera` 以下をカメラサーバー（標準17720番）へ転送します。`/camera/ws` のWebSocket Upgradeも中継します。カメラ管理画面はこのサイトからiframeで表示するため、サーバーのCSP frame-ancestorsやX-Frame-OptionsでこのGitHub Pagesからの埋め込みを拒否しない設定が必要です。埋め込めない場合は「別タブで開く」も使えます。

このリポジトリは操作画面だけです。接続サーバーの起動・HTTPS・TURN・Discord OAuthの設定や認証情報は含みません。サーバー未準備ならカメラ接続はまだ使えません。

## 保存と解除

管理キーは入力したタブのsessionStorageに保持します。GitHubやソースコード、localStorageには書き込みません。接続解除で消します。接続先サーバーの管理画面へはiframeのフラグメントで渡します。管理キーは信頼できるカメラサーバーだけに入力してください。

「接続解除」はこのサイトから管理画面を閉じる操作です。参加者の映像送信そのものは停止しません。停止する場合は参加者の送信停止、管理画面でリンク再発行、またはカメラサーバー停止を使ってください。

## 検証

`node --test tests/addresses.test.cjs`

HTTPS接続先の検証・プレビューURLの接続先制限をテストしています。実際のHTTPSカメラサーバー・実カメラ・OBSとの接続は未検証です。
