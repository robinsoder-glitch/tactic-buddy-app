import { Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HomeGroundOption({
  homeGround,
  value,
  onChange,
}: {
  homeGround: string | null | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  const ground = homeGround?.trim();
  if (!ground) return null;
  const selected = value.trim() === ground;
  return (
    <Button
      type="button"
      size="sm"
      variant={selected ? "secondary" : "outline"}
      aria-pressed={selected}
      className="h-auto min-h-9 max-w-full justify-start whitespace-normal text-left"
      onClick={() => onChange(ground)}
    >
      <MapPin className="size-4 shrink-0" aria-hidden />
      <span>Hemmaplan: {ground}</span>
      {selected && <Check className="size-4 shrink-0" aria-hidden />}
    </Button>
  );
}
