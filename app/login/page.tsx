import { LoginForm } from "@/components/login-form";
import { AuthCallback } from "@/components/auth-callback";

type LoginPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const reason = params.reason;

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
            承認済みメールアドレスへ届くログインリンクをご利用ください。
          </p>
          <LoginForm reason={reason} />
          <AuthCallback />
        </div>
      </section>
    </main>
  );
}
