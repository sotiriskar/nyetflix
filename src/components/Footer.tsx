import Facebook from '@mui/icons-material/Facebook';
import Instagram from '@mui/icons-material/Instagram';
import LinkedIn from '@mui/icons-material/LinkedIn';

export interface FooterSocialLinks {
  linkedin?: string;
}

interface FooterProps {
  /** LinkedIn URL; omit to use the default */
  socialLinks?: FooterSocialLinks;
}

const DEFAULT_LINKEDIN = 'https://www.linkedin.com/in/sotiris-kar/';

const FOOTER_COLUMNS = [
  ['Audio Description', 'Investor Relations', 'Legal Notices'],
  ['Help Centre', 'Jobs', 'Cookie Preferences', 'Corporate Information'],
  ['Gift Cards', 'Terms of Use', 'Media Centre', 'Privacy', 'Contact Us'],
];

export function Footer({ socialLinks }: FooterProps) {
  const linkedin = socialLinks?.linkedin || DEFAULT_LINKEDIN;

  return (
    <footer className="bg-[#141414] text-white/70 pt-12 pb-8 pl-20 pr-6 md:pl-36 md:pr-12">
      {/* Social icons – Facebook/Instagram decorative only; LinkedIn is the real link */}
      <div className="flex gap-4 mb-8">
        <span
          className="text-white/70 hover:text-white transition-colors cursor-pointer"
          aria-hidden="true"
        >
          <Facebook sx={{ fontSize: 28 }} />
        </span>
        <span
          className="text-white/70 hover:text-white transition-colors cursor-pointer"
          aria-hidden="true"
        >
          <Instagram sx={{ fontSize: 28 }} />
        </span>
        <a
          href={linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white/70 hover:text-white transition-colors"
          aria-label="LinkedIn"
        >
          <LinkedIn sx={{ fontSize: 28 }} />
        </a>
      </div>

      {/* Link-style text – not clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6 max-w-4xl">
        {FOOTER_COLUMNS.map((column, i) => (
          <div key={i} className="flex flex-col gap-2">
            {column.map((label) => (
              <span key={label} className="text-sm text-white/70 cursor-default">
                {label}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="mb-6">
        <span className="inline-block px-3 py-1.5 text-sm border border-white/50 text-white/70 cursor-default">
          Service Code
        </span>
      </div>

      <p className="text-sm text-white/50">© 2023–2026 Nyetflix, Inc.</p>
    </footer>
  );
}
