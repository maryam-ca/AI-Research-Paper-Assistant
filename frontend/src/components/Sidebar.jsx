import { Link } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-gray-50 p-4 flex flex-col gap-6">
      <Link to="/" className="text-lg font-semibold text-gray-900 no-underline">
        Paper Assistant
      </Link>

      <nav className="flex flex-col gap-1">
        <Link
          to="/"
          className="rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 no-underline"
        >
          Library
        </Link>
      </nav>
    </aside>
  );
}
