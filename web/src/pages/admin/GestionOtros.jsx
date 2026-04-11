import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Stethoscope, Save, X } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, Button, Input, Select } from './components/ui';

// Simple Modal Component
const Modal = ({ isOpen, title, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b pb-3">
                    <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                {children}
            </Card>
        </div>
    );
};

export default function GestionOtros({ farmacia }) {
    const [servicios, setServicios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentService, setCurrentService] = useState(null);
    const [categories, setCategories] = useState([]);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [formData, setFormData] = useState({
        nombre: '',
        precioVenta: '',
        categoriaId: '', 
        codigoSunat: ''
    });

    const fetchServicios = async () => {
        if (!farmacia?.id) return;
        setLoading(true);
        try {
            const { data } = await api.get('/servicios', {
                params: { farmaciaId: farmacia.id }
            });
            setServicios(data);
        } catch (error) {
            console.error("Error fetching servicios:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        if (!farmacia?.id) return;
        try {
            const { data } = await api.get('/servicios/categorias', {
                params: { farmaciaId: farmacia.id }
            });
            setCategories(data);
            // Si hay categorías y el form no tiene una, seleccionar la primera
            if (data.length > 0 && !formData.categoriaId) {
                setFormData(prev => ({ ...prev, categoriaId: data[0].id }));
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    };

    useEffect(() => {
        fetchServicios();
        fetchCategories();
    }, [farmacia]);

    const handleOpenModal = (service = null) => {
        if (service) {
            setCurrentService(service);
            setFormData({
                nombre: service.nombre,
                precioVenta: service.precioVenta,
                categoriaId: service.categoriaId || 1,
                codigoSunat: service.codigoSunat || ''
            });
        } else {
            setCurrentService(null);
            setFormData({
                nombre: '',
                precioVenta: '',
                categoriaId: categories.length > 0 ? categories[0].id : '',
                codigoSunat: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                precioVenta: parseFloat(formData.precioVenta),
                categoriaId: parseInt(formData.categoriaId),
                farmaciaId: farmacia.id
            };

            if (currentService) {
                await api.put(`/servicios/${currentService.id}`, payload);
            } else {
                await api.post('/servicios', payload);
            }

            fetchServicios();
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving service:", error);
            alert(error.response?.data?.error || 'Error al guardar el servicio');
        }
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        try {
            await api.post('/servicios/categorias', { 
                nombre: newCategoryName,
                farmaciaId: farmacia.id
            });
            setNewCategoryName('');
            fetchCategories();
        } catch (error) {
            console.error("Error saving category:", error);
            alert(error.response?.data?.error || 'Error al guardar la categoría');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Está seguro de eliminar este servicio?')) return;
        try {
            await api.delete(`/servicios/${id}`);
            fetchServicios();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.error || 'Error al eliminar');
        }
    };

    const filteredServicios = servicios.filter(s =>
        s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.codigoSunat && s.codigoSunat.includes(searchTerm))
    );

    if (!farmacia?.id) return <Card><p>Seleccione una farmacia.</p></Card>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
                        <Stethoscope className="text-indigo-600" />
                        Gestión de Otros (Servicios)
                    </h1>
                    <p className="text-gray-500">Administra inyectables, consultas y otros servicios.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setIsCategoryModalOpen(true)}>
                        Gestionar Categorías
                    </Button>
                    <Button onClick={() => handleOpenModal()}>
                        <Plus size={20} /> Nuevo Servicio
                    </Button>
                </div>
            </div>

            <Card>
                <div className="mb-4">
                    <Input
                        placeholder="Buscar por nombre o código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        icon={<Search size={20} />}
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="p-4 font-semibold text-gray-600">Nombre</th>
                                <th className="p-4 font-semibold text-gray-600">Categoría</th>
                                <th className="p-4 font-semibold text-gray-600">Precio</th>
                                <th className="p-4 font-semibold text-gray-600 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="p-4 text-center">Cargando...</td></tr>
                            ) : filteredServicios.length === 0 ? (
                                <tr><td colSpan="5" className="p-4 text-center text-gray-500">No hay servicios registrados.</td></tr>
                            ) : (
                                filteredServicios.map(servicio => (
                                    <tr key={servicio.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="p-4 font-medium">{servicio.nombre}</td>
                                        <td className="p-4 text-sm text-gray-500">
                                            {categories.find(c => c.id === servicio.categoriaId)?.nombre || 'General'}
                                        </td>
                                        <td className="p-4 font-bold text-green-600">S/ {parseFloat(servicio.precioVenta || 0).toFixed(2)}</td>
                                        <td className="p-4 flex justify-end gap-2">
                                            <Button variant="secondary" size="sm" onClick={() => handleOpenModal(servicio)}>
                                                <Edit2 size={16} />
                                            </Button>
                                            <Button variant="danger" size="sm" onClick={() => handleDelete(servicio.id)}>
                                                <Trash2 size={16} />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={currentService ? 'Editar Servicio' : 'Nuevo Servicio'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Nombre del Servicio"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        required
                        placeholder="Ej. Inyectable Intramuscular"
                    />
                    <Select
                        label="Categoría"
                        value={formData.categoriaId}
                        onChange={(e) => setFormData({ ...formData, categoriaId: e.target.value })}
                    >
                        {categories.length === 0 && <option value="" disabled>No hay categorías</option>}
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                    </Select>
                    <Input
                        label="Precio que me cuesta (S/)"
                        type="number"
                        step="0.01"
                        value={formData.precioVenta}
                        onChange={(e) => setFormData({ ...formData, precioVenta: e.target.value })}
                        required
                        placeholder="0.00"
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" variant="primary">
                            <Save size={18} /> Guardar
                        </Button>
                    </div>
                </form>
            </Modal>
            <Modal
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                title="Gestionar Categorías"
            >
                <div className="space-y-4">
                    <form onSubmit={handleSaveCategory} className="flex gap-2 items-end">
                        <div className="flex-1">
                            <Input
                                label="Nueva Categoría"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Ej. Laboratorio"
                                required
                            />
                        </div>
                        <Button type="submit" variant="primary" className="mb-1">
                            <Plus size={18} /> Agregar
                        </Button>
                    </form>
                    
                    <div className="mt-4 max-h-48 overflow-y-auto border rounded-lg bg-gray-50">
                        {categories.length === 0 ? (
                            <p className="p-4 text-center text-gray-500 text-sm">No hay categorías. Agrega la primera.</p>
                        ) : (
                            <ul className="divide-y divide-gray-200">
                                {categories.map(cat => (
                                    <li key={cat.id} className="p-3 flex justify-between items-center text-sm text-gray-700 bg-white hover:bg-gray-50">
                                        <span>{cat.nombre}</span>
                                        <span className="text-xs text-gray-400">ID: {cat.id}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button variant="secondary" onClick={() => setIsCategoryModalOpen(false)}>Cerrar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
