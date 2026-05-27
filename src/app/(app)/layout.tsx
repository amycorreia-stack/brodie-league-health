import { Nav } from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--glass-background)" }}
    >
      <Nav />
      <main className="flex-1 overflow-auto px-6 sm:px-10 py-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
