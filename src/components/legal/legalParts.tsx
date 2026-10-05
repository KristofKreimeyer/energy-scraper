import type { ReactNode } from "react";

// Geteilte Typografie-Bausteine der rechtlichen Seiten.
export const H2 = ({ children }: { children: ReactNode }) => <h2 className="text-[1.75rem] text-ink mt-8 mb-2">{children}</h2>;

export const H3 = ({ children }: { children: ReactNode }) => <h3 className="text-[1rem] font-semibold text-ink mt-6 mb-2">{children}</h3>;

export const Pp = ({ children }: { children: ReactNode }) => <p className="text-[1rem] leading-relaxed text-ink/90 mb-4">{children}</p>;
