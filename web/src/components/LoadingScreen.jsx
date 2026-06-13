import { Stethoscope } from "lucide-react";

export default function LoadingScreen({ message = "Cargando el sistema..." }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden px-4"
      style={{
        background:
          "linear-gradient(135deg, rgba(2,6,23,0.62) 0%, rgba(23,37,84,0.55) 50%, rgba(30,27,75,0.62) 100%)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
      role="status"
      aria-live="polite"
    >
      {/* Tarjeta glassmorphism: horizontal en escritorio, vertical en móvil */}
      <div
        className="relative flex flex-col sm:flex-row items-center gap-7 sm:gap-10 px-8 py-9 sm:px-14 sm:py-11 rounded-[32px] w-full max-w-[340px] sm:max-w-[560px]"
        style={{
          background: "rgba(255,255,255,0.07)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        {/* Spinner doble aro con el ícono de marca al centro */}
        <div className="relative w-[88px] h-[88px] sm:w-[104px] sm:h-[104px] shrink-0">
          <div
            className="absolute inset-0 rounded-full"
            style={{ border: "3px solid rgba(255,255,255,0.07)" }}
          />
          <div
            className="absolute inset-0 rounded-full animate-spin"
            style={{
              border: "3px solid transparent",
              borderTopColor: "rgba(255,255,255,0.8)",
              animationDuration: "0.85s",
            }}
          />
          <div
            className="absolute inset-[9px] rounded-full animate-spin"
            style={{
              border: "2px solid transparent",
              borderTopColor: "rgba(255,255,255,0.22)",
              animationDuration: "1.4s",
              animationDirection: "reverse",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
              <Stethoscope size={26} className="text-white sm:hidden" aria-hidden="true" />
              <Stethoscope size={30} className="text-white hidden sm:block" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Texto y puntos: centrado en móvil, alineado a la izquierda en escritorio */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <p className="text-xl sm:text-2xl font-black text-white/90 tracking-tight">CB MEDIC</p>
          <p className="text-sm sm:text-[15px] text-white/45 font-medium mt-1.5 tracking-wide">
            {message}
          </p>
          <div className="flex items-center gap-2.5 mt-5">
            {[0, 160, 320].map((delay, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-white/40 animate-bounce"
                style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
