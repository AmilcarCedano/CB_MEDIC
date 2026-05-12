import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { X, Camera, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * BarcodeScannerModal
 * - La cámara se enciende al abrir y se APAGA al cerrar (o al escanear)
 * - Prefiere cámara trasera en móvil
 * - Soporta EAN-13, EAN-8, Code128, Code39, QR, DataMatrix
 */
export default function BarcodeScannerModal({ isOpen, onClose, onResult }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const stopCamera = () => {
    if (readerRef.current) {
      try { readerRef.current.reset(); } catch (_) {}
      readerRef.current = null;
    }
    // Detener tracks de video explícitamente
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setError(null);
    setScanning(false);
    setLastResult(null);

    const startScanner = async () => {
      try {
        // Configurar hints para máxima compatibilidad de formatos
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.DATA_MATRIX,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        readerRef.current = new BrowserMultiFormatReader(hints);
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();

        if (devices.length === 0) {
          if (!cancelled) setError('No se encontró cámara en este dispositivo.');
          return;
        }

        // Preferir cámara trasera / environment en móvil
        const backCamera = devices.find(d => {
          const lbl = d.label.toLowerCase();
          return lbl.includes('back') || lbl.includes('rear') ||
                 lbl.includes('trasera') || lbl.includes('environment');
        }) || devices[devices.length - 1];

        if (!cancelled) setScanning(true);

        await readerRef.current.decodeFromVideoDevice(
          backCamera.deviceId,
          videoRef.current,
          (result, err) => {
            if (result && !cancelled) {
              const code = result.getText();
              setLastResult(code);
              // Pequeño delay visual de "detectado" antes de cerrar
              setTimeout(() => {
                if (!cancelled) {
                  onResult(code);
                  handleClose();
                }
              }, 200);
            }
            // err es normal en frames sin código (ChecksumException, NotFoundException) — ignorar
          }
        );
      } catch (err) {
        if (!cancelled) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setError('Permiso de cámara denegado. Habilita el acceso en la barra del navegador.');
          } else if (err.name === 'NotFoundError') {
            setError('No se encontró cámara. Asegúrate de tener una cámara disponible.');
          } else {
            setError(`Error al iniciar la cámara: ${err.message}`);
          }
          setScanning(false);
        }
      }
    };

    startScanner();

    // Cleanup: apagar cámara al desmontar o al cerrarse
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen]); // eslint-disable-line

  const handleClose = () => {
    stopCamera();
    setScanning(false);
    setError(null);
    setLastResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="relative w-full max-w-sm bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
          <div className="flex items-center gap-2 text-white">
            <Camera size={18} className="text-indigo-400" />
            <span className="font-bold text-sm">Escanear Código de Barras</span>
          </div>
          <button onClick={handleClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-full hover:bg-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Video */}
        <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />

          {/* Overlay con guía de escaneo */}
          {scanning && !error && !lastResult && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Fondo oscuro en bordes */}
              <div className="absolute inset-0 bg-black/30" style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, 8% 20%, 8% 80%, 92% 80%, 92% 20%, 8% 20%)'
              }} />
              {/* Marco guía */}
              <div className="relative" style={{ width: '80%', height: '38%' }}>
                {/* Esquinas */}
                {[
                  'top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl',
                  'top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr',
                  'bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl',
                  'bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br',
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-7 h-7 border-indigo-400 ${cls}`} />
                ))}
                {/* Línea de escaneo animada */}
                <div className="absolute left-1 right-1 h-0.5 bg-red-400/80 rounded-full"
                  style={{ animation: 'scanline 1.8s ease-in-out infinite alternate', top: '50%' }} />
              </div>
            </div>
          )}

          {/* Detectado! */}
          {lastResult && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
              <div className="bg-green-500 text-white rounded-2xl px-6 py-3 flex items-center gap-2 shadow-xl">
                <CheckCircle size={22} />
                <span className="font-bold text-sm">¡Detectado!</span>
              </div>
            </div>
          )}
        </div>

        {/* Estado */}
        <div className="px-4 py-3 bg-gray-800 text-center min-h-[52px] flex items-center justify-center">
          {error ? (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : lastResult ? (
            <p className="text-green-400 text-xs font-mono font-bold truncate">{lastResult}</p>
          ) : scanning ? (
            <p className="text-indigo-300 text-xs animate-pulse">
              Apunta la cámara al código · Centra dentro del marco
            </p>
          ) : (
            <p className="text-gray-400 text-xs">Iniciando cámara...</p>
          )}
        </div>

        <style>{`
          @keyframes scanline {
            from { top: 15%; }
            to   { top: 85%; }
          }
        `}</style>
      </div>
    </div>
  );
}
