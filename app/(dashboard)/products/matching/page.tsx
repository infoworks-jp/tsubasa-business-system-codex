import { ProductMatchingManager } from "@/components/product-matching-manager";

export default function ProductMatchingPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Product matching</p>
          <h1>商品照合と売上確認</h1>
          <p className="lead">OCR原文を保持し、人が商品と売上を確認した明細だけを確定集計へ反映します。</p>
        </div>
        <span className="badge">推測照合なし</span>
      </div>
      <ProductMatchingManager />
    </>
  );
}
