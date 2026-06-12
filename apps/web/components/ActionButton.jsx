export function ActionButton({ children, variant = "primary", className = "", ...props }) {
  const variants = {
    primary: "bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
    warning: "bg-orange-500 text-white hover:bg-orange-600"
  };

  return (
    <button
      className={`rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant] || variants.primary} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
