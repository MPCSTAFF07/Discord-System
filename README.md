# MPC Discord Camera — Cloudflare版

参加者のカメラ送信・OBS受信をCloudflareで接続します。レンタルサーバーや独自ドメインは不要です。まだユーザーのCloudflareアカウントへの本番デプロイは行っていません。

## 初回の設定

1. Cloudflareアカウントを作る。
2. CloudflareのRealtime → TURNでキーを作成する。Key IDとAPI Tokenを控える。
3. Node.jsのLTS版をインストールする。
4. このリポジトリをZIPで展開し、`DEPLOY_CLOUDFLARE.bat` を実行する。
5. Cloudflareへ本人がログインし、管理キー（ADMIN_KEY）・TURN Key ID・TURN API Tokenを入力する。
6. 公開時に表示された `https://mpc-discord-camera.<自分のサブドメイン>.workers.dev` がサーバーURL。自分で設定したADMIN_KEYが管理キー。

詳細: [cloudflare/README_JA.md](cloudflare/README_JA.md)

キーはチャットやGitHubのファイルに貼らず、BAT内で開くWranglerの入力欄へ入力してください。利用前にCloudflare側の無料枠・課金設定を確認してください。使用量によって費用が発生するため、常に無料という保証はありません。

## 管理サイトをGitHub Pagesで公開

Settings → Pages → Source「Deploy from a branch」→ Branch「main」・フォルダ「/docs」→ Save。

公開後のURL: https://mpcstaff07.github.io/Discord-System/

非公開リポジトリでPagesを利用できない契約の場合は、この画面用リポジトリの公開設定または対応プランが必要です。Cloudflare側のカメラ画面はworkers.devで公開されるので、GitHub Pagesを公開しなくても直接使用できます。

## 操作

1. 管理サイトへCloudflareのURLとADMIN_KEYを入力。
2. 一覧で選手名を登録し、選手別の「送信リンク」を本人へ渡す。
3. 参加者はカメラ確認→送信開始。マイクは取得しない。
4. 「ブラウザで受信確認」で映像を確認。
5. 「OBS URL」をOBSブラウザソースへ貼る。

GitHubの画面はCloudflareの管理画面を埋め込んで操作します。映像はGitHubを通らずWebRTCで流れ、直接接続できない場合はCloudflare TURNで中継します。

## MavaValoOverlay

公開サーバー接続対応版の「カメラ」タブへ、CloudflareのURLとADMIN_KEYを入力します。設定が保存されたらIngameブラウザソースを再読み込みします。A1～A5・B1～B5の選手枠を一致させてください。Pythonサーバー・Docker・Caddy・coturnを手元で起動する必要はありません。

## 認証と保存

Cloudflare版は選手別の招待リンク方式です。Discordログインによる本人確認はまだ含みません。Bot音声とは別機能です。

ADMIN_KEYとTURNの長期API TokenはWorkers Secretsへ保存します。選手名・招待キー・閲覧キーはDurable Objectの非公開データとして保存します。コードへ秘密値を埋め込みません。ブラウザへは有効期限付きのTURN資格情報だけを発行します。

管理サイトの管理キーはタブのsessionStorageにのみ保持します。「接続解除」で消します。接続解除は管理画面を閉じる操作で、選手の送信そのものを止める操作ではありません。停止する場合は、参加者が送信停止するか、管理画面でリンクを再発行します。

## 検証

管理サイト: `node --test tests/addresses.test.cjs`

Cloudflare側: `cd cloudflare` → `npm ci` → `npm test` → `npm run check`

Workersローカル実行環境で管理者認証・設定保存・WebSocketシグナリング・招待の無効化を検証します。Cloudflare本番への公開・TURN実API・実カメラ・OBSはアカウント設定後の実機確認が必要です。
