import { X } from "lucide-react";

export const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-lg p-6 ${className}`}>{children}</div>
);

export const Button = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  type = "button",
  disabled = false,
}) => {
  const base =
    "px-4 py-2 font-semibold rounded-lg transition duration-150 ease-in-out flex items-center justify-center gap-2";
  const colors = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-400",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100",
    danger: "bg-red-500 text-white hover:bg-red-600 disabled:bg-red-400",
    success: "bg-green-500 text-white hover:bg-green-600 disabled:bg-green-400",
    ghost: "bg-transparent text-gray-600 hover:text-indigo-600",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${colors[variant] || colors.primary} ${className}`}
    >
      {children}
    </button>
  );
};

export const Input = ({ label, className = "", ...props }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <input
      {...props}
      className={`p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${className}`}
    />
  </div>
);

export const Select = ({ label, className = "", children, ...props }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <select
      {...props}
      className={`p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white appearance-none ${className}`}
    >
      {children}
    </select>
  </div>
);

export const Modal = ({ isOpen, title, onClose, children, maxWidth = "max-w-xl" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className={`${maxWidth} w-full max-h-[95vh] overflow-y-auto`}>
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <Button variant="ghost" onClick={onClose} className="p-1">
            <X size={18} />
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
};
