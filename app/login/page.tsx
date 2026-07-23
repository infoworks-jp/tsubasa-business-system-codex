import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="brand">
          <div className="brand-mark">翼</div>
          <div className="brand-copy">
            <strong>味一番つばさ</strong>
            <small>Business System</small>
          </div>
        </div>
        <div className="login-copy">
          <p className="eyebrow" style={{ color: "#f1b45f" }}>
            Tsubasa operations
          </p>
          <h1>毎日の数字を、根拠とともに。</h1>
          <p style={{ color: "rgba(255,255,255,.72)", lineHeight: 1.8 }}>
            売上・商品・原本・確認状況をひとつの流れで管理するための基盤です。
          </p>
        </div>
        <small style={{ color: "rgba(255,255,255,.55)" }}>
          Codex版 / Phase 1
        </small>
      </section>

      <section className="login-form-wrap">
        <div className="login-form">
          <p className="eyebrow">Secure access</p>
          <h1 style={{ fontSize: 34 }}>ログイン</h1>
          <p className="lead" style={{ marginBottom: 30 }}>
            店舗管理アカウントでログインしてください。
          </p>
          <label className="field">
            メールアドレス
            <input
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              disabled
            />
          </label>
          <label className="field">
            パスワード
            <input
              type="password"
              placeholder="••••••••••"
              autoComplete="current-password"
              disabled
            />
          </label>
          <Link className="button" href="/" style={{ width: "100%" }}>
            雛形画面を確認
          </Link>
          <p className="form-note">
            認証処理は未実装です。Supabase接続後に有効化します。
          </p>
        </div>
      </section>
    </main>
  );
}
