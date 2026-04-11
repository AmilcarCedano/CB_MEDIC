const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'web/src/pages/admin/AdminShell.jsx');

try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Add Stethoscope and FileHeart to imports
    if (!content.includes('Stethoscope,')) {
        content = content.replace(
            'Activity,',
            'Activity,\n  Stethoscope,\n  FileHeart,'
        );
    }

    // 2. Add GestionServicios import
    if (!content.includes('import GestionServicios')) {
        content = content.replace(
            'import Auditoria from "./Auditoria.jsx";',
            'import Auditoria from "./Auditoria.jsx";\nimport GestionServicios from "./GestionServicios.jsx";\nimport ComprobantesServicios from "./ComprobantesServicios.jsx";'
        );
    }

    // 3. Add to screens object
    if (!content.includes('GestionServicios: { name:')) {
        content = content.replace(
            'Auditoria: { name: "Auditoría", icon: Activity, context: "Farmacy" },',
            'Auditoria: { name: "Auditoría", icon: Activity, context: "Farmacy" },\n  GestionServicios: { name: "Gestión de Servicios", icon: Stethoscope, context: "Farmacy" },\n  ComprobantesServicios: { name: "Comprobantes Servicios", icon: FileHeart, context: "Farmacy" },'
        );
    }

    // 4. Add to switch case
    if (!content.includes('case "GestionServicios":')) {
        content = content.replace(
            'case "Auditoria":\n        return <Auditoria farmacia={selectedFarmacia} />;',
            'case "Auditoria":\n        return <Auditoria farmacia={selectedFarmacia} />;\n      case "GestionServicios":\n        return <GestionServicios farmacia={selectedFarmacia} />;\n      case "ComprobantesServicios":\n        return <ComprobantesServicios farmacia={selectedFarmacia} />;'
        );
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('AdminShell.jsx updated successfully!');

} catch (err) {
    console.error('Error updating file:', err);
}
