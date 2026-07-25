interface AudioThumbnailProps {
  className?: string;
}

export function AudioThumbnail({ className = "w-8 h-8" }: AudioThumbnailProps) {
  return (
    <svg
      className={`${className} flex-shrink-0 text-neutral-500 dark:text-neutral-400`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}