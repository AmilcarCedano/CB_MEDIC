import { Stethoscope } from "lucide-react";

export default function LoadingScreen({ message = "Cargando el sistema..." }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(2,6,23,0.62) 0%, rgba(23,37,84,0.55) 50%, rgba(30,27,75,0.62) 100%)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
      role="status"
      aria-live="polite"
    >

      {/* Tarjeta glassmorphism */}
      <div
        className="relative flex flex-col items-center gap-5 px-10 py-8 rounded-[32px]"
        style={{
          background: "rgba(255,255,255,0.07)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        {/* Icono de marca */}
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
          <Stethoscope size={24} className="text-white" aria-hidden="true" />
        </div>

        {/* Spinner doble aro */}
        <div className="relative w-[52px] h-[52px]">
          <div
            className="absolute inset-0 rounded-full"
            style={{ border: "2px solid rgba(255,255,255,0.07)" }}
          />
          <div
            className="absolute inset-0 rounded-full animate-spin"
            style={{
              border: "2px solid transparent",
              borderTopColor: "rgba(255,255,255,0.8)",
              animationDuration: "0.85s",
            }}
          />
          <div
            className="absolute inset-[6px] rounded-full animate-spin"
            style={{
              border: "1.5px solid transparent",
              borderTopColor: "rgba(255,255,255,0.22)",
              animationDuration: "1.4s",
              animationDirection: "reverse",
            }}
          />
        </div>

        <div className="text-center">
          <p className="text-[14px] font-black text-white/85 tracking-tight">CB MEDIC</p>
          <p className="text-[10px] text-white/35 font-medium mt-1 tracking-wide">{message}</p>
        </div>

        {/* Puntos rebotando */}
        <div className="flex items-center gap-2">
          {[0, 160, 320].map((delay, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-white/35 animate-bounce"
              style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
