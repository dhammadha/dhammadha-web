import FontDetail from "./FontDetail";

export function generateStaticParams() {
  return [{ designer: "_", slug: "_" }];
}

export default function FontPage() {
  return <FontDetail />;
}
