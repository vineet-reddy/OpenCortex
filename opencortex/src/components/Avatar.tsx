interface AvatarProps {
  initials: string;
  name: string;
  size?: "sm" | "md" | "lg";
}

// Elegant, muted color palette that complements the warm light theme
const colors = [
  "from-[#8b3a3a] to-[#6b2a2a]", // burgundy
  "from-[#4a7c59] to-[#3a6249]", // forest
  "from-[#5a7a8c] to-[#4a6a7c]", // slate blue
  "from-[#8c7a5a] to-[#6c5a4a]", // warm taupe
  "from-[#7a5a8c] to-[#5a4a6c]", // dusty purple
  "from-[#6a7a6a] to-[#5a6a5a]", // sage
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const sizeClasses = {
  sm: "w-8 h-8 text-[11px]",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
};

export default function Avatar({ initials, name, size = "md" }: AvatarProps) {
  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${getColor(name)} flex items-center justify-center text-white flex-shrink-0 shadow-sm ring-2 ring-white/80`}
      style={{ 
        fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
        fontWeight: 500,
        fontStyle: "italic"
      }}
      title={name}
    >
      {initials}
    </div>
  );
}
