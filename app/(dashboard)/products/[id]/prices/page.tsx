import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ConnectionRequired } from "@/components/connection-required";
import { getProductRepository } from "@/lib/products/get-repository";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";

export const dynamic = "force-dynamic";

export default async function ProductPricesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const repository = getProductRepository();
    const [product, prices] = await Promise.all([
      repository.find(id),
      repository.prices(id),
    ]);
    if (!product) notFound();
    const history = [...prices].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
    return (
      <>
        <header className="page-heading">
          <div>
            <p className="eyebrow">Price history</p>
            <h1>価格履歴</h1>
            <p className="lead">{product.productCode} / {product.productName}</p>
          </div>
          <Link className="button secondary" href="/products"><ArrowLeft size={17} />一覧へ戻る</Link>
        </header>
        <section className="card panel">
          <div className="table-wrap">
            <table>
              <thead><tr><th>変更前</th><th>変更後</th><th>適用開始日</th><th>適用終了日</th><th>変更理由</th><th>記録日時</th></tr></thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state">価格履歴はまだありません。</div></td></tr>
                ) : history.map((price, index) => {
                    const previousPrice = history[index + 1]?.price;
                    return (
                      <tr key={price.id}>
                        <td>{previousPrice === undefined ? "―" : `¥${previousPrice.toLocaleString("ja-JP")}`}</td>
                        <td><strong>¥{price.price.toLocaleString("ja-JP")}</strong></td>
                        <td>{price.validFrom}</td>
                        <td>{price.validTo ?? "現在"}</td>
                        <td>{price.changeReason}</td>
                        <td>{new Date(price.createdAt).toLocaleString("ja-JP")}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      </>
    );
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return <ConnectionRequired />;
    throw error;
  }
}
