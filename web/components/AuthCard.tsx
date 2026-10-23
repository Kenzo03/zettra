import Image from "next/image";
import Icon from "./Icon";
import hero from "./auth-hero.webp";

// The sign-in and password setup pages: no card, the logo at the top left, the
// form in the middle, and an optional muted line at the bottom. From lg up the
// hero image fills the right half. It is imported, not served from public/,
// so it is a /_next/static file that the sign-in proxy lets through.
export default function AuthCard({
  title,
  lead,
  footer,
  children,
}: {
  title: string;
  lead?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen">
      <div className="flex flex-1 flex-col px-6 py-10 lg:px-18">
        <div className="flex items-center gap-2">
          <Icon name="logo" className="size-7 text-accent" />
          <span className="text-lg font-extrabold">Zettra</span>
        </div>
        <div className="my-auto flex max-w-[360px] flex-col gap-4 py-10">
          <h1 className="text-[34px] leading-[1.1] font-extrabold tracking-[-0.025em]">{title}</h1>
          {lead && <p className="-mt-1 mb-2.5 text-[15px] leading-normal text-ink-soft">{lead}</p>}
          {children}
        </div>
        {footer && <p className="text-[12.5px] text-muted">{footer}</p>}
      </div>
      <div className="relative m-3 hidden flex-1 overflow-hidden rounded-2xl lg:block">
        <Image src={hero} alt="" fill preload placeholder="blur" quality={90} sizes="50vw" className="object-cover" />
      </div>
    </main>
  );
}
