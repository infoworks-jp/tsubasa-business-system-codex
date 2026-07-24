export default function SetupOwnerPage() {
  return (
    <main className="login-page">
      <section className="login-form-wrap">
        <div className="login-form">
          <p className="eyebrow">One-time setup</p>
          <h1>最初の利用者を作成</h1>
          <p className="lead">
            ここへ加来さんが受信できるメールアドレスを入力してください。
          </p>
          <label className="field">
            加来さん専用メールアドレス
            <input
              aria-label="加来さん専用メールアドレス"
              autoComplete="email"
              placeholder="name@example.com"
              type="email"
            />
          </label>
          <p className="form-note">
            入力した時点では送信されません。Workが内容を確認してから、所有者アカウント作成とログインリンク送信を実行します。
          </p>
        </div>
      </section>
    </main>
  );
}
