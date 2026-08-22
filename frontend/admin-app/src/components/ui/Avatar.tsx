import { initials } from "@/lib/utils";

export function Avatar({ name, color, size = 36, photoUrl }: { name: string; color: string; size?: number; photoUrl?: string }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}
