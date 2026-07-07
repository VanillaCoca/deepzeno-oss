import { AuthAside } from "@/components/auth/auth-aside";
import { AuthThemeToggle } from "@/components/auth/auth-theme-toggle";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-screen bg-sidebar">
      <div className="flex w-full flex-col bg-background p-8 md:p-16 xl:w-[600px] xl:shrink-0 xl:rounded-r-2xl xl:border-r xl:border-border/40">
        <div className="flex items-center justify-end gap-1">
          <AuthThemeToggle />
          <LocaleSwitcher />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10">
          <div className="flex flex-col gap-2">{children}</div>
        </div>
      </div>

      <div className="hidden flex-1 xl:flex">
        <AuthAside />
      </div>
    </div>
  );
}
