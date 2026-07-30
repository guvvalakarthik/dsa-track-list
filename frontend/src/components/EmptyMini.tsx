import { Circle } from "lucide-react";

export function EmptyMini({ text }: { text: string }) {
  return <div className="empty-mini"><Circle size={17} /><span>{text}</span></div>;
}
