interface ModelTagProps {
  label: string;
  variant: "quant" | "size" | "family";
}

export function ModelTag({ label, variant }: ModelTagProps) {
  const colorClasses = {
    quant: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    size: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    family: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  };

  if (!label) return null;

  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${colorClasses[variant]}`}
    >
      {label}
    </span>
  );
}