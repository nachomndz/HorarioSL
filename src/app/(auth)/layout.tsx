import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-6 py-6 text-center">
        <Link
          href="/"
          className="font-serif text-2xl font-semibold text-foreground hover:opacity-80"
        >
          HorarioSL
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">Colegio San Lorenzo · Gijón</p>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
