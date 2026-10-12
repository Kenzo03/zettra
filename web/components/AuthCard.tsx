import Image from "next/image";
import Icon from "./Icon";
import { panel } from "@/lib/ui";
import hero from "./auth-hero.webp";

// The centered card of the sign-in and password setup pages. From lg up the
// hero image fills the right half. It is imported, not served from public/,
// so it is a /_next/static file that the sign-in proxy lets through.
export default function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="mb-5 flex items-center justify-center gap-2">
            <Icon name="logo" className="size-7 text-accent" />
            <span className="text-2xl font-semibold">Zettra</span>
          </div>
          <div className={`${panel} p-6 shadow-sm`}>
            <h1 className="mb-5 text-lg font-semibold">{title}</h1>
            {children}
          </div>
        </div>
      </div>
      <div className="relative m-3 hidden flex-1 overflow-hidden rounded-2xl lg:block">
        <Image src={hero} alt="" fill preload placeholder="blur" sizes="50vw" className="object-cover" />
      </div>
    </main>
  );
}
