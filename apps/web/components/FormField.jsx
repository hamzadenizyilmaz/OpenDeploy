export function FormField({ label, name, value, onChange, type = "text", required = false, placeholder = "", children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      {children || (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-500 dark:focus:ring-slate-800"
          value={value ?? ""}
          onChange={onChange}
        />
      )}
    </label>
  );
}
