import FontDetail from "./FontDetail";

export function generateStaticParams() {
  return [{ slug: "_" }];
}

export default function FontPage() {
  return <FontDetail />;
}
