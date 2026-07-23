import { Cable, FileKey2, ShieldAlert } from "lucide-react";

export function ConnectionRequired() {
  return (
    <section className="card connection-card" role="alert">
      <div className="connection-icon">
        <Cable size={28} aria-hidden="true" />
      </div>
      <div>
        <p className="eyebrow">Configuration required</p>
        <h2>Supabase接続情報が未設定です</h2>
        <p className="lead">
          アプリは停止していません。商品データを表示・保存するには、Supabase の SQL を適用したうえで、ローカル専用の
          <code>.env.local</code> に接続情報を設定してください。
        </p>
        <ol className="setup-list">
          <li>
            <FileKey2 size={17} aria-hidden="true" />
            <span>
              <code>.env.example</code> を <code>.env.local</code> に複製
            </span>
          </li>
          <li>
            <ShieldAlert size={17} aria-hidden="true" />
            <span>URLと秘密鍵を設定し、秘密情報はGitへ含めない</span>
          </li>
        </ol>
      </div>
    </section>
  );
}
