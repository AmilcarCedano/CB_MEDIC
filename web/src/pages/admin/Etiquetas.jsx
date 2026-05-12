import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../lib/api';
import { Card, Button, Input, Modal } from './components/ui';
import { Search, Tag, Printer, AlertTriangle, Barcode, RefreshCw, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDateSafe } from '../../lib/dateUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateEAN13 = () => {
  const prefix = '200';
  let digits = prefix;
  for (let i = 0; i < 9; i++) digits += Math.floor(Math.random() * 10).toString();
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i], 10) * (i % 2 === 0 ? 1 : 3);
  return digits + ((10 - (sum % 10)) % 10).toString();
};

const DEFAULT_CONFIG = {
  widthMm: 58,
  heightMm: 40,
  columns: 2,
  showPrice: true,
  showLote: true,
  showVencimiento: true,
  showBarcode: true,
};

const CONFIG_KEY = 'cb_label_config';
const loadConfig = () => {
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') }; }
  catch { return DEFAULT_CONFIG; }
};
const saveConfig = (cfg) => localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));

// ─── BarcodeCanvas ─────────────────────────────────────────────────────────
const BarcodeCanvas = ({ value, width = 200, height = 50 }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    canvas.width = width; canvas.height = height;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    const str = value.toString();
    const bw = Math.max(1, Math.floor(width / (str.length * 11 + 35)));
    let x = 6;
    ctx.fillStyle = '#000';
    [2,1,1,2,3,2].forEach(w => { ctx.fillRect(x, 0, w*bw, height-14); x += w*bw + bw; });
    for (const char of str) {
      const code = char.charCodeAt(0);
      const pat = [(code>>6)&1?2:1,(code>>5)&1?2:1,(code>>4)&1?3:1,(code>>3)&1?2:1,(code>>2)&1?1:2,(code>>1)&1?2:1];
      pat.forEach((w,i) => { if(i%2===0) ctx.fillRect(x,0,w*bw,height-14); x+=w*bw; });
    }
    [2,3,1,1,2,1,2].forEach((w,i) => { if(i%2===0) ctx.fillRect(x,0,w*bw,height-14); x+=w*bw; });
    ctx.fillStyle='#000'; ctx.font='bold 9px monospace'; ctx.textAlign='center';
    ctx.fillText(value, width/2, height-2);
  }, [value, width, height]);
  return <canvas ref={ref} style={{ display:'block', margin:'0 auto' }} />;
};

// ─── LabelPreview ──────────────────────────────────────────────────────────
const LabelPreview = ({ product, config, isVendedor }) => {
  // Vendedor puede ver la etiqueta completa, pero sin precio
  const showPrice = config.showPrice && !isVendedor;
  const px = (mm) => Math.round(mm * 3.78);
  const W = px(config.widthMm);
  const H = px(config.heightMm);

  return (
    <div style={{
      width: W, minHeight: H,
      border: '1.5px solid #374151', borderRadius: 6,
      background: '#fff', padding: '6px 8px',
      fontFamily: 'Arial, sans-serif', boxSizing: 'border-box',
      margin: '0 auto',
    }}>
      {/* Nombre */}
      <p style={{ fontWeight: 800, fontSize: Math.max(8, Math.min(13, W/16)), margin: '0 0 4px',
        lineHeight: 1.2, textAlign: 'center', color: '#111',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={product.nombre}>
        {product.nombre}
      </p>

      {/* Código de barras */}
      {config.showBarcode && (
        <BarcodeCanvas value={product.codigoBarras || '0000000000000'} width={W - 18} height={32} />
      )}

      {/* Info row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end',
        marginTop: 4, borderTop: '1px solid #e5e7eb', paddingTop: 3 }}>
        <div>
          {config.showLote && (
            <p style={{ fontSize: 7, color:'#6b7280', margin: 0, textTransform:'uppercase' }}>
              Lote: <span style={{ fontWeight:700, color:'#374151' }}>{product.lote || 'N/A'}</span>
            </p>
          )}
          {config.showVencimiento && product.fechaVencimiento && (
            <p style={{ fontSize: 7, color:'#6b7280', margin: 0 }}>
              Venc: {formatDateSafe(product.fechaVencimiento)}
            </p>
          )}
        </div>
        {showPrice && (
          <p style={{ fontWeight:900, fontSize: Math.max(12, Math.min(18, W/12)),
            color:'#4338ca', margin: 0, lineHeight:1 }}>
            S/ {Number(product.precioVenta || 0).toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
};

// ─── ConfigPanel ───────────────────────────────────────────────────────────
const ConfigPanel = ({ config, onChange, isVendedor }) => {
  const [open, setOpen] = useState(false);
  const field = (label, key, type, opts = {}) => (
    <div>
      <label style={{ fontSize:12, fontWeight:600, display:'block', marginBottom:2 }}>{label}</label>
      {type === 'select' ? (
        <select value={config[key]} onChange={e => onChange({ ...config, [key]: Number(e.target.value) })}
          className="w-full p-2 border rounded-lg text-sm">
          {opts.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : type === 'checkbox' ? (
        <input type="checkbox" checked={config[key]}
          onChange={e => onChange({ ...config, [key]: e.target.checked })}
          className="w-4 h-4" disabled={opts.disabled} />
      ) : (
        <input type="number" value={config[key]} min={opts.min || 20} max={opts.max || 200}
          onChange={e => onChange({ ...config, [key]: Number(e.target.value) })}
          className="w-full p-2 border rounded-lg text-sm" />
      )}
    </div>
  );

  return (
    <div className="mb-4 border border-indigo-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold text-sm">
        <span className="flex items-center gap-2"><Settings size={16} /> Configuración de Etiquetadora</span>
        {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
      </button>
      {open && (
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 bg-white">
          {field('Ancho (mm)', 'widthMm', 'number', { min:30, max:200 })}
          {field('Alto (mm)', 'heightMm', 'number', { min:20, max:200 })}
          {field('Columnas', 'columns', 'select', { options:[{v:1,l:'1 columna'},{v:2,l:'2 columnas'},{v:3,l:'3 columnas'}] })}
          <div className="flex flex-col gap-2 mt-1">
            <label className="text-xs font-semibold">Campos visibles</label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.showBarcode}
                onChange={e => onChange({...config, showBarcode: e.target.checked})} className="w-4 h-4"/>
              Código de barras
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.showLote}
                onChange={e => onChange({...config, showLote: e.target.checked})} className="w-4 h-4"/>
              Lote
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.showVencimiento}
                onChange={e => onChange({...config, showVencimiento: e.target.checked})} className="w-4 h-4"/>
              Vencimiento
            </label>
            {!isVendedor && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={config.showPrice}
                  onChange={e => onChange({...config, showPrice: e.target.checked})} className="w-4 h-4"/>
                Precio
              </label>
            )}
          </div>
          <div className="col-span-2 md:col-span-3 text-xs text-gray-400 flex gap-2 flex-wrap">
            {[
              {l:'Etiqueta Pequeña (40×20mm)',w:40,h:20,c:3},
              {l:'Rollo 58mm (58×40mm)',w:58,h:40,c:2},
              {l:'Zebra 62mm (62×38mm)',w:62,h:38,c:2},
              {l:'Carta 1 col (90×50mm)',w:90,h:50,c:1},
            ].map(p => (
              <button key={p.l} onClick={() => onChange({...config,widthMm:p.w,heightMm:p.h,columns:p.c})}
                className="px-2 py-1 border border-indigo-200 rounded-full hover:bg-indigo-50 text-indigo-700 font-medium">
                {p.l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
const Etiquetas = ({ farmacia, user }) => {
  const isVendedor = user?.role === 'VENDEDOR';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [generating, setGenerating] = useState(false);
  const [printPreview, setPrintPreview] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [config, setConfig] = useState(loadConfig);

  const updateConfig = (newCfg) => { setConfig(newCfg); saveConfig(newCfg); };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/products?farmaciaId=${farmacia.id}`);
      setProducts(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (farmacia?.id) fetchProducts(); }, [farmacia?.id]);

  const sortedProducts = useMemo(() => {
    const low = searchTerm.toLowerCase();
    let filtered = products;
    if (searchTerm) {
      filtered = products.filter(p =>
        p.nombre.toLowerCase().includes(low) ||
        (p.codigoBarras && p.codigoBarras.toLowerCase().includes(low)) ||
        (p.lote && p.lote.toLowerCase().includes(low))
      );
    }
    return [...filtered].sort((a, b) => {
      if (!a.codigoBarras && b.codigoBarras) return -1;
      if (a.codigoBarras && !b.codigoBarras) return 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [products, searchTerm]);

  const countWithoutBarcode = useMemo(() => products.filter(p => !p.codigoBarras).length, [products]);

  const handleGenerateBarcode = async (product) => {
    setGenerating(true);
    try {
      const newBarcode = generateEAN13();
      await api.put(`/products/${product.id}`, { codigoBarras: newBarcode, farmaciaId: farmacia.id });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, codigoBarras: newBarcode } : p));
      setPrintPreview({ ...product, codigoBarras: newBarcode });
      setQuantity(1);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al generar código de barras');
    } finally { setGenerating(false); }
  };

  const handleShowLabel = (product) => { setPrintPreview(product); setQuantity(1); };

  const handlePrint = () => {
    if (!printPreview) return;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) { alert('Habilita los popups para imprimir'); return; }

    const showPrice = config.showPrice && !isVendedor;
    const codigoBarras = printPreview.codigoBarras || '';
    const cols = config.columns;
    const W = config.widthMm;
    const H = config.heightMm;

    // Construir etiquetas individuales como <td>
    const labelCell = (i) => `
      <td style="width:${W}mm;padding:2mm;vertical-align:top;">
        <div id="label-${i}" style="
          width:${W}mm;min-height:${H}mm;max-height:${H + 10}mm;
          border:1pt solid #374151;border-radius:2mm;
          background:#fff;padding:2mm 2.5mm;
          font-family:Arial,sans-serif;box-sizing:border-box;
          display:flex;flex-direction:column;justify-content:space-between;
          page-break-inside:avoid;
        ">
          <p style="font-weight:800;font-size:${Math.max(6, Math.min(10, W / 7))}pt;
            margin:0 0 1mm;line-height:1.2;text-align:center;color:#111;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
            title="${printPreview.nombre.replace(/"/g, '&quot;')}">
            ${printPreview.nombre}
          </p>
          ${config.showBarcode && codigoBarras
            ? `<canvas id="bc-${i}" style="display:block;margin:0 auto;"></canvas>`
            : ''}
          <div style="display:flex;justify-content:space-between;align-items:flex-end;
            margin-top:1mm;border-top:0.5pt solid #d1d5db;padding-top:1mm;">
            <div style="font-size:5.5pt;color:#6b7280;line-height:1.5;">
              ${config.showLote ? `<div>Lote: <strong style="color:#374151">${printPreview.lote || 'N/A'}</strong></div>` : ''}
              ${config.showVencimiento && printPreview.fechaVencimiento
                ? `<div>Venc: ${formatDateSafe(printPreview.fechaVencimiento)}</div>` : ''}
            </div>
            ${showPrice
              ? `<div style="font-weight:900;font-size:${Math.max(9, Math.min(14, W / 5))}pt;color:#4338ca;line-height:1;">
                  S/${Number(printPreview.precioVenta || 0).toFixed(2)}
                </div>`
              : ''}
          </div>
        </div>
      </td>`;

    // Agrupar en filas de `cols` columnas
    const rows = [];
    for (let i = 0; i < quantity; i += cols) {
      const cells = Array.from({ length: cols }, (_, j) => {
        const idx = i + j;
        return idx < quantity ? labelCell(idx) : `<td style="width:${W}mm;"></td>`;
      }).join('');
      rows.push(`<tr>${cells}</tr>`);
    }

    // Script de inicialización de barcodes
    const barcodeScript = config.showBarcode && codigoBarras
      ? `
        var barW = Math.max(1, Math.floor((${W} * 3.78 - 10) / 80));
        var barH = Math.max(18, Math.floor(${H} * 3.78 / 3.5));
        for (var i = 0; i < ${quantity}; i++) {
          try {
            var c = document.getElementById('bc-' + i);
            if (c) JsBarcode(c, '${codigoBarras}', {
              format: 'CODE128', width: barW, height: barH,
              displayValue: true, fontSize: 8, margin: 1
            });
          } catch(e) { console.warn('barcode error', i, e); }
        }
      `
      : '';

    printWindow.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>Etiquetas - ${printPreview.nombre}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { margin: 4mm; background: #fff; }
    table { border-collapse: separate; border-spacing: 2mm; }
    @media print {
      body { margin: 2mm; }
      @page { margin: 4mm; size: auto; }
    }
  </style>
</head><body>
  <table><tbody>${rows.join('')}</tbody></table>
  <script>
    window.onload = function() {
      ${barcodeScript}
      setTimeout(function() { window.print(); }, 600);
    };
  <\/script>
</body></html>`);
    printWindow.document.close();
  };

  return (
    <Card>
      <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Creación de Etiquetas</h2>
          <p className="text-sm text-gray-500">Genera e imprime etiquetas con código de barras{!isVendedor ? ', precio' : ''} y lote</p>
        </div>
        <div className="flex items-center gap-3">
          {countWithoutBarcode > 0 && (
            <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200">
              <AlertTriangle size={14} />
              {countWithoutBarcode} sin código
            </div>
          )}
          <div className="relative">
            <Input placeholder="Buscar producto..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>
          <Button variant="secondary" onClick={fetchProducts} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      <ConfigPanel config={config} onChange={updateConfig} isVendedor={isVendedor} />

      <div className="overflow-x-auto">
        {loading && <p className="text-center p-8 text-gray-400">Cargando productos...</p>}
        {!loading && sortedProducts.length === 0 && (
          <p className="text-center p-8 text-gray-500">No se encontraron productos.</p>
        )}
        {!loading && sortedProducts.length > 0 && (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-bold text-gray-700 text-sm">Producto</th>
                <th className="text-left p-3 font-bold text-gray-700 text-sm">Código de Barras</th>
                <th className="text-left p-3 font-bold text-gray-700 text-sm">Lote</th>
                {!isVendedor && <th className="text-right p-3 font-bold text-gray-700 text-sm">Precio</th>}
                <th className="text-center p-3 font-bold text-gray-700 text-sm">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((p) => (
                <tr key={p.id} className={`border-b hover:bg-gray-50 transition-colors ${!p.codigoBarras ? 'bg-amber-50/40' : ''}`}>
                  <td className="p-3">
                    <div className="font-bold text-gray-900 text-sm">{p.nombre}</div>
                    <div className="text-xs text-gray-500">{p.categoria?.nombre}</div>
                  </td>
                  <td className="p-3">
                    {p.codigoBarras ? (
                      <span className="font-mono text-sm text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{p.codigoBarras}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-full text-xs font-bold border border-amber-200">
                        <AlertTriangle size={12} /> Sin código
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-gray-600 font-mono">{p.lote || '---'}</td>
                  {!isVendedor && (
                    <td className="p-3 text-right font-bold text-indigo-700">S/ {Number(p.precioVenta || 0).toFixed(2)}</td>
                  )}
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      {!p.codigoBarras ? (
                        <Button variant="primary" size="sm" onClick={() => handleGenerateBarcode(p)} disabled={generating} title="Generar código de barras">
                          <Barcode size={14} className="mr-1" /> Generar Código
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleShowLabel(p)} title="Ver etiqueta">
                          <Tag size={14} className="mr-1" /> Etiqueta
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Preview */}
      {printPreview && (
        <Modal isOpen={!!printPreview} onClose={() => setPrintPreview(null)} title="Vista Previa de Etiqueta">
          <div className="space-y-5">
            {/* Preview mejorado */}
            <div className="flex items-center justify-center p-4 bg-gray-100 rounded-xl min-h-[120px]">
              <LabelPreview product={printPreview} config={config} isVendedor={isVendedor} />
            </div>

            {/* Indicadores de config */}
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                {config.widthMm}×{config.heightMm} mm
              </span>
              <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                {config.columns} col.
              </span>
              {config.showBarcode && <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">✓ Código barras</span>}
              {config.showPrice && !isVendedor && <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">✓ Precio</span>}
              {config.showLote && <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">✓ Lote</span>}
            </div>

            <div className="flex items-center justify-center gap-4">
              <label className="text-sm font-medium text-gray-700">Cantidad:</label>
              <input type="number" min="1" max="200" value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(200, parseInt(e.target.value) || 1)))}
                className="w-20 p-2 border border-gray-300 rounded-lg text-center font-bold" />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setPrintPreview(null)}>Cerrar</Button>
              <Button variant="primary" onClick={handlePrint}>
                <Printer size={16} className="mr-2" />
                Imprimir {quantity > 1 ? `${quantity} etiquetas` : 'etiqueta'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
};

export default Etiquetas;
