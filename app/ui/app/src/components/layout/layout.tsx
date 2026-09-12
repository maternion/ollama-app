import { Link } from "@tanstack/react-router";
import { useSettings } from "@/hooks/useSettings";
import { ChatIcon } from "@/components/ChatIcon";

export function SidebarLayout({
  sidebar,
  title,
  children,
}: React.PropsWithChildren<{
  sidebar: React.ReactNode;
  title?: string;
  collapsible?: boolean;
  chatId?: string;
}>) {
  const { settings, setSettings } = useSettings();
  const isWindows = navigator.platform.toLowerCase().includes("win");

  return (
    <div className={`flex h-screen transition-[width] duration-300 dark:bg-neutral-900`}>
      <div
        className={`absolute flex mx-2 py-2 z-20 items-center transition-[left] duration-375 text-neutral-500 dark:text-neutral-400 ${settings.sidebarOpen ? (isWindows ? "left-2" : "left-[204px]") : isWindows ? "left-2" : "left-20"}`}
      >
        <button
          onClick={() => setSettings({ SidebarOpen: !settings.sidebarOpen })}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700/75 cursor-pointer"
          aria-label={settings.sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          title={settings.sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          <svg
            className="h-5 w-5 fill-current"
            viewBox="0 0 24 19"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M7.76132 16.6344H9.58103V1.59842H7.76132V16.6344ZM4.20898 18.2316H19.124C21.6518 18.2316 23.1293 16.6963 23.1293 14.0209V4.2205C23.1293 1.54512 21.6518 0.00351715 19.124 0.00351715H4.20898C1.54336 0.00351715 0 1.54512 0 4.2205V14.0209C0 16.6963 1.54336 18.2316 4.20898 18.2316ZM4.31191 16.3184C2.79628 16.3184 1.91327 15.4434 1.91327 13.926V4.31542C1.91327 2.79979 2.79628 1.91678 4.31191 1.91678H18.8174C20.333 1.91678 21.216 2.79979 21.216 4.31542V13.926C21.216 15.4434 20.333 16.3184 18.8174 16.3184H4.31191ZM5.85116 5.50038C6.1951 5.50038 6.49217 5.20507 6.49217 4.87968C6.49217 4.54628 6.1951 4.25722 5.85116 4.25722H3.8412C3.49725 4.25722 3.20819 4.54628 3.20819 4.87968C3.20819 5.20507 3.49725 5.50038 3.8412 5.50038H5.85116ZM5.85116 8.1158C6.1951 8.1158 6.49217 7.82049 6.49217 7.4871C6.49217 7.1537 6.1951 6.8744 5.85116 6.8744H3.8412C3.49725 6.8744 3.20819 7.1537 3.20819 7.4871C3.20819 7.82049 3.49725 8.1158 3.8412 8.1158H5.85116ZM5.85116 10.725C6.1951 10.725 6.49217 10.4439 6.49217 10.1105C6.49217 9.77713 6.1951 9.48983 5.85116 9.48983H3.8412C3.49725 9.48983 3.20819 9.77713 3.20819 10.1105C3.20819 10.4439 3.49725 10.725 3.8412 10.725H5.85116Z" />
          </svg>
        </button>
        {!title && (
          <Link
            to="/c/$chatId"
            params={{ chatId: "new" }}
            title="New chat"
            className={`flex ml-1 items-center justify-center rounded-full transition-opacity duration-375 h-9 w-9 hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
              settings.sidebarOpen
                ? "opacity-0 pointer-events-none"
                : "opacity-100"
            }`}
          >
            <ChatIcon />
          </Link>
        )}
      </div>
      <div
        className={`flex flex-col transition-[width] duration-300 max-h-screen ${settings.sidebarOpen ? "w-64" : "w-0"}`}
      >
        <div
          onDoubleClick={() => window.doubleClick && window.doubleClick()}
          onMouseDown={() => window.drag && window.drag()}
          className="flex-none h-13 w-full"
        ></div>
        {settings.sidebarOpen && sidebar}
      </div>
      <main
        className={`flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden transition-all duration-300`}
      >
        <div
          className={`h-13 flex-none w-full z-10 flex items-center bg-white dark:bg-neutral-900 ${isWindows ? "xl:hidden" : "xl:fixed xl:bg-transparent xl:dark:bg-transparent"}`}
          onDoubleClick={() => window.doubleClick && window.doubleClick()}
          onMouseDown={() => window.drag && window.drag()}
        ></div>
        {children}
      </main>
    </div>
  );
}
