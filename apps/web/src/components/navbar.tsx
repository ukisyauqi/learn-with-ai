import Link from "next/link";
import { Brain } from "@phosphor-icons/react/dist/ssr";
import { auth, signOut } from "@/lib/auth";
import { Button } from "./ui/button";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href={session ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Brain className="h-5 w-5" weight="bold" />
          </span>
          Learn with AI
        </Link>
        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:block">
                {session.user.name ?? session.user.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button variant="outline" size="sm" type="submit">
                  Keluar
                </Button>
              </form>
            </>
          ) : (
            <Link href="/">
              <Button size="sm">Masuk</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
