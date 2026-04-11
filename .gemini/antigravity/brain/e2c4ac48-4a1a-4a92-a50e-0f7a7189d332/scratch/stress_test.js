
async function runStressTest() {
    const API_URL = 'http://localhost:4000';
    let farmaciaId = 1; 
    let userId = 1;

    console.log('🚀 Iniciando Prueba de Estrés para CBMedic...');
    const startTime = Date.now();

    try {
        // 0. Identificar Farmacia y Producto con Stock
        console.log('--- Preparación: Identificando datos ---');
        // Intentar obtener farmacias para sacar un ID válido
        // El backend suele tener /farmacias pero vamos a probar con ?farmaciaId=1
        
        let targetProduct = null;
        for (let fid of [1, 2, 3]) {
            try {
                const prodRes = await fetch(`${API_URL}/products?farmaciaId=${fid}`);
                const products = await prodRes.json();
                if (products && Array.isArray(products)) {
                    targetProduct = products.find(p => p.stockActual > 5);
                    if (targetProduct) {
                        farmaciaId = fid;
                        console.log(`✅ Usando Farmacia ID: ${farmaciaId}`);
                        console.log(`✅ Usando Producto: ${targetProduct.nombre} (ID: ${targetProduct.id}, Stock: ${targetProduct.stockActual})`);
                        break;
                    }
                }
            } catch (e) {}
        }

        if (!targetProduct) {
            console.log('⚠️ No se encontró un producto con stock. Saltando test de ventas.');
        }

        // 1. Carga de Productos
        console.log('\n--- Test: Carga de Productos ---');
        const productStart = Date.now();
        const productRequests = Array(50).fill().map(() => 
            fetch(`${API_URL}/products?farmaciaId=${farmaciaId}`)
        );
        await Promise.all(productRequests);
        console.log(`✅ 50 peticiones de productos completadas en ${Date.now() - productStart}ms`);

        // 2. Carga de Clientes
        console.log('\n--- Test: Carga de Clientes ---');
        const clientStart = Date.now();
        const clientRequests = Array(30).fill().map(() => 
            fetch(`${API_URL}/clientes`, { headers: { 'x-farmacia-id': String(farmaciaId) } })
        );
        await Promise.all(clientRequests);
        console.log(`✅ 30 peticiones de clientes completadas en ${Date.now() - clientStart}ms`);

        // 3. Ventas Concurrentes
        if (targetProduct) {
            console.log('\n--- Test: Simulación de Ventas Concurrentes ---');
            const salePayload = {
                cart: [{ 
                    id: targetProduct.id, 
                    quantity: 1, 
                    type: 'PRODUCT', 
                    price: parseFloat(targetProduct.precioVenta), 
                    nombre: targetProduct.nombre,
                    precioUnitario: parseFloat(targetProduct.precioVenta),
                    dbId: targetProduct.id,
                    codigo: targetProduct.codigoBarras || 'TEST'
                }],
                clienteId: null,
                metodoPago: 'Efectivo',
                amountReceived: parseFloat(targetProduct.precioVenta),
                appliedPoints: 0,
                documentType: 'Nota de Venta'
            };

            const saleStart = Date.now();
            const saleRequests = Array(10).fill().map(() => 
                fetch(`${API_URL}/sales`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-farmacia-id': String(farmaciaId),
                        'x-user-id': String(userId)
                    },
                    body: JSON.stringify(salePayload)
                })
            );
            const results = await Promise.allSettled(saleRequests);
            const success = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
            const failed = results.filter(r => r.status === 'rejected' || (r.value && !r.value.ok)).length;
            console.log(`✅ 10 ventas procesadas en ${Date.now() - saleStart}ms (Éxitos: ${success}, Fallos: ${failed})`);
        }

        console.log(`\n🏁 Prueba finalizada en ${Date.now() - startTime}ms`);
    } catch (err) {
        console.error('❌ Error fatal en el test:', err.message);
    }
}

runStressTest();
