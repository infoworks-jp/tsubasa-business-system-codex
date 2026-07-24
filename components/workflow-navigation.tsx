import Link from "next/link";

const steps = [
  { href: "/sources", label: "1. 原本台帳" },
  { href: "/ocr", label: "2. 明細確認" },
  { href: "/products/matching", label: "3. 商品・売上確認" },
  { href: "/", label: "4. 集計確認" },
];

export function WorkflowNavigation() {
  return (
    <nav aria-label="実運用フロー" className="workflow-navigation">
      {steps.map((step) => <Link href={step.href} key={step.href}>{step.label}</Link>)}
    </nav>
  );
}
