import { notFound } from "next/navigation";
import { ConnectionRequired } from "@/components/connection-required";
import { ProductForm } from "@/components/product-form";
import { getProductRepository } from "@/lib/products/get-repository";
import { SupabaseNotConfiguredError } from "@/lib/products/repository";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let product;
  try {
    product = await getProductRepository().find(id);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return <ConnectionRequired />;
    throw error;
  }
  if (!product) notFound();

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Edit product</p>
          <h1>商品を編集</h1>
          <p className="lead">{product.productCode} / {product.productName}</p>
        </div>
      </header>
      <ProductForm mode="edit" product={product} />
    </>
  );
}
