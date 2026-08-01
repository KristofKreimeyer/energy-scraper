import type { ReactNode } from "react";

// Geteilte Typografie-Bausteine der rechtlichen Seiten.
export const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="text-[1.15rem] font-bold text-ink mt-8 mb-2">{children}</h2>
);

export const H3 = ({ children }: { children: ReactNode }) => (
  <h3 className="text-[0.98rem] font-semibold text-ink mt-5 mb-1.5">
    {children}
  </h3>
);

export const Pp = ({ children }: { children: ReactNode }) => (
  <p className="text-[0.9rem] leading-relaxed text-ink/90 mb-3">{children}</p>
);
