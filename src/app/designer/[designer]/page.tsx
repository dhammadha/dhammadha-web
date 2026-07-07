import DesignerDetail from "./DesignerDetail";

export function generateStaticParams() {
  return [{ designer: "_" }];
}

export default function DesignerPage() {
  return <DesignerDetail />;
}
