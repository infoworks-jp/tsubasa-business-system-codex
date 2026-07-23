import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { ConnectionRequired } from "@/components/connection-required";
import { ProductStatusButton } from "@/components/product-status-button";
import { getProductRepository } from "@/lib/products/get-repository";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/products/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  search?: string;
  category?: string;
  active?: string;
  sortBy?: string;
  sortDirection?: string;
  saved?: string;
}>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const category = PRODUCT_CATEGORIES.includes(params.category as ProductCategory)
    ? (params.category as ProductCategory)
    : "";
  const active =
    params.active === "active" || params.active === "inactive"
      ? params.active
      : "all";
  const sortBy = params.sortBy === "name" ? "name" : "code";
  const sortDirection = params.sortDirection === "desc" ? "desc" : "asc";

  let products;
  try {
    products = await getProductRepository().list({
      search: params.search,
      category,
      active,
      sortBy,
      sortDirection,
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return (
        <>
          <PageHeading />
          <ConnectionRequired />
        </>
      );
    }
    throw error;
  }

  return (
    <>
      <PageHeading />
      {params.saved && (
        <div className="notice success" role="status">{params.saved}</div>
      )}
      <section className="card panel">
        <form className="filter-bar">
          <label className="search-wrap">
            <Search size={17} aria-hidden="true" />
            <input
              className="search"
              defaultValue={params.search}
              name="search"
              placeholder="商品コード・商品名で検索"
              type="search"
            />
          </label>
          <select defaultValue={category} name="category" aria-label="カテゴリ">
            <option value="">すべてのカテゴリ</option>
            {PRODUCT_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select defaultValue={active} name="active" aria-label="有効状態">
            <option value="all">有効・無効すべて</option>
            <option value="active">有効のみ</option>
            <option value="inactive">無効のみ</option>
          </select>
          <select defaultValue={sortBy} name="sortBy" aria-label="並び替え">
            <option value="code">商品コード順</option>
            <option value="name">商品名順</option>
          </select>
          <select defaultValue={sortDirection} name="sortDirection" aria-label="並び順">
            <option value="asc">昇順</option>
            <option value="desc">降順</option>
          </select>
          <button className="button secondary" type="submit">絞り込む</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>商品コード</th><th>商品名</th><th>カテゴリ</th>
                <th>券売機ボタン</th><th>標準価格</th><th>販売期間</th>
                <th>状態</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state">条件に一致する商品はありません。</div></td></tr>
              ) : products.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.productCode}</strong></td>
                  <td>{product.productName}</td>
                  <td>{product.category}</td>
                  <td>{product.ticketButtonNumber ?? "―"}</td>
                  <td>¥{product.standardPrice.toLocaleString("ja-JP")}</td>
                  <td>{product.salesStartDate}<br /><span className="muted">～ {product.salesEndDate ?? "販売中"}</span></td>
                  <td>
                    <div className="status-stack">
                      <span className={`status ${product.isActive ? "success" : ""}`}>{product.isActive ? "有効" : "無効"}</span>
                      {!product.isActive && product.deactivationReason ? <span className="muted">{product.deactivationReason}</span> : null}
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/products/${product.id}/edit`}>編集</Link>
                      <Link href={`/products/${product.id}/prices`}>価格履歴</Link>
                      <ProductStatusButton productId={product.id} active={product.isActive} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PageHeading() {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">Product master</p>
        <h1>商品マスター</h1>
        <p className="lead">商品情報、販売状態、価格履歴を管理します。</p>
      </div>
      <Link className="button" href="/products/new"><Plus size={17} aria-hidden="true" />商品を追加</Link>
    </header>
  );
}
