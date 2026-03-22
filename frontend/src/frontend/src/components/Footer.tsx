import { SiDiscord, SiGithub, SiX } from "react-icons/si";

const FOOTER_COLS = [
  {
    heading: "Product",
    links: ["Features", "Roadmap", "Pricing", "Changelog"],
  },
  {
    heading: "Resources",
    links: ["Documentation", "API Reference", "Guides", "Blog"],
  },
  {
    heading: "Company",
    links: ["About", "Careers", "Press", "Contact"],
  },
  {
    heading: "Legal",
    links: ["Privacy Policy", "Terms of Service", "Cookie Policy", "Security"],
  },
];

export default function Footer() {
  return (
    <footer className="mt-12 mb-8">
      <div className="glass rounded-3xl p-8">
        <div className="grid grid-cols-4 gap-8 mb-8">
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-3">
                {col.heading}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[oklch(0.78_0.16_196)] to-[oklch(0.60_0.20_264)] flex items-center justify-center">
              <span className="text-white font-bold text-xs">A</span>
            </div>
            <span className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Arcadia Inc. Built with ❤️ using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-arcadia-teal hover:underline"
              >
                caffeine.ai
              </a>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <SiGithub className="w-4 h-4" />
            </a>
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <SiX className="w-4 h-4" />
            </a>
            <a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <SiDiscord className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
