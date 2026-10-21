# Cloudflareカメラ接続

レンタルサーバー・独自ドメインを用意せず、Cloudflare Workersの `https://mpc-discord-camera.<自分のサブドメイン>.workers.dev` で参加者のカメラを接続します。GitHubの管理画面からも、このURLと管理キーで操作できます。

## 構成

- Workers: 管理・参加者送信・OBS受信画面
- SQLite-backed Durable Object: 選手名、招待キー、接続情報の保存とWebSocketシグナリング
- Cloudflare Realtime TURN: P2Pでつながらない回線の映像中継

SFUへ全映像を常時送る構成ではなく、P2P+TURNです。参加者はブラウザだけで送信でき、運営PCでPythonサーバーを起動する必要はありません。

## 初回の準備

1. Cloudflareアカウントを作成。
2. Cloudflareの「Realtime」→「TURN」でTURNキーを作成し、Key IDとAPI Tokenを控える。
3. このGitHubリポジトリをダウンロードし、この `cloudflare` フォルダをPowerShellで開く。Node.jsのLTS版を用意する。
4. 次を実行。

    npm ci
    npx wrangler login

ログイン画面は本人が操作してください。

## 公開

`cloudflare` フォルダで順に実行します。

    npx wrangler deploy
    npx wrangler secret put ADMIN_KEY
    npx wrangler secret put TURN_KEY_ID
    npx wrangler secret put TURN_KEY_API_TOKEN

各secretコマンドの入力欄へ値を入力します。ADMIN_KEYには自分で決めた32文字以上のランダムな管理キー、残り2つにはCloudflareのTURNキー情報を入力します。入力した管理キーはパスワード管理ソフトなどに保管してください。秘密値をコードやチャットへ貼らないでください。

最初のdeploy直後は秘密設定が足りないため、管理APIは503、カメラ接続は設定不足のエラーになります。秘密設定が完了するまでは参加者へリンクを配らないでください。公開前にCloudflare側で利用枠・課金設定を確認してください。常に完全無料になる保証はありません。

deploy時に表示されるworkers.devのURLが「サーバーURL」、自分で設定したADMIN_KEYが「管理キー」です。独自ドメインは不要です。

## 操作

1. GitHubの管理サイトへworkers.devのURLと管理キーを入力。
2. 選手名を入力して保存。
3. 「送信リンク」を本人へ渡す。
4. 参加者がカメラ確認→送信開始。
5. 「ブラウザで受信確認」で映像を確認。
6. 「OBS URL」をOBSのブラウザソースへ貼る。

管理サイトを使わず、 `https://自分のWorker/camera#token=管理キー` からも直接管理できます。受信URLの#以降も含めてOBSへ貼ってください。

## MavaValoOverlayとの連携

以前配布した統合版の「カメラ」タブに、workers.devのURLと管理キーを入力します。「公開カメラ管理を開く」で閲覧用設定を保存し、Ingameのブラウザソースを更新してください。管理画面のA1〜B5をPC側の選手枠に合わせます。

## 制限・認証

このCloudflare版は選手枠別の招待リンク方式です。Discordログインによる本人確認は未実装です。DiscordユーザーIDを入力して本人認証した扱いにはしません。Bot音声の処理とは別機能です。

招待キー・閲覧キーはDurable Objectへ保存します。ADMIN_KEY・TURNキーはWorkers Secretsだけへ保存します。カメラ接続後にだけ有効期限12時間のTURN資格情報を発行し、ブラウザへ長期API Tokenは送りません。12時間以上使う場合は再接続してください。受信画面を増やすほど映像の通信量は増えます。

「リンク再発行」は選手の送信を切って旧招待キーを無効にします。Workerデータを消さない限り、通常のコード更新で選手の設定は保持します。管理キーの変更はWorkers Secretで行います。

## 開発検証

    npm test
    npm run check

Cloudflareへの本番デプロイ、実カメラ、OBS、外部回線はアカウント設定後の確認が必要です。旧Linux版のDocker・Caddy・coturnを設置する必要はありません。
