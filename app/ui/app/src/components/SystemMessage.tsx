export function SystemMessage({ message }: { message: { role: string; content: string } }) {
  return (
    <div className="flex mb-4 flex-col">
      <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-3 max-w-full">
        <div className="flex items-center gap-2 mb-1">
          <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 8H2" />
          </svg>
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">System</span>
        </div>
        <div className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    </div>
  );
}
