import Link from "next/link";

type BaseProps = {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = BaseProps &
  (
    | ({ as?: "button" } & React.ButtonHTMLAttributes<HTMLButtonElement>)
    | ({ as: "a" } & React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; external?: boolean })
    | ({ as: "link" } & { href: string; target?: string; rel?: string })
  );

const SIZE = {
  sm: "px-4 py-2 text-[13px]",
  md: "px-5 py-2.5 text-[14px]",
  lg: "px-6 py-3 text-[15px]",
};

const VARIANT = {
  primary: "bg-mint text-white hover:bg-navy border-mint hover:border-navy",
  outline: "bg-transparent text-navy border-navy hover:bg-navy hover:text-white",
  ghost: "bg-transparent text-navy border-transparent hover:bg-[#f5f5f2]",
};

function cls(variant: keyof typeof VARIANT, size: keyof typeof SIZE, extra = "") {
  return `inline-flex items-center justify-center gap-2 font-semibold rounded-[9px] border transition-colors cursor-pointer no-underline ${SIZE[size]} ${VARIANT[variant]} ${extra}`;
}

export default function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className = "", children } = props;
  const base = cls(variant, size, className);

  if (props.as === "link") {
    return (
      <Link href={props.href} target={props.target} rel={props.rel} className={base}>
        {children}
      </Link>
    );
  }

  if (props.as === "a") {
    const { as: _a, variant: _v, size: _s, className: _c, external, ...rest } = props as never as {
      as: "a"; variant: string; size: string; className: string; external?: boolean;
      href: string; children: React.ReactNode; [k: string]: unknown;
    };
    return (
      <a {...rest} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className={base}>
        {children}
      </a>
    );
  }

  const { as: _a, variant: _v, size: _s, className: _c, ...rest } = props as never as {
    as?: "button"; variant: string; size: string; className: string;
    children: React.ReactNode; [k: string]: unknown;
  };
  return (
    <button {...rest} className={base}>
      {children}
    </button>
  );
}
