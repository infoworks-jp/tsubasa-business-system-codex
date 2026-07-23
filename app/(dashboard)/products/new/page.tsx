import { ProductForm } from "@/components/product-form";

export default function NewProductPage() {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">New product</p>
          <h1>商品を新規登録</h1>
          <p className="lead">必須項目を入力し、確認後に保存します。</p>
        </div>
      </header>
      <ProductForm mode="create" />
    </>
  );
}
