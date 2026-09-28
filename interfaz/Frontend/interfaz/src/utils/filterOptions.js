import { productLabel } from './supplierCatalog';

const normalize = (text) => String(text || '').trim().toLowerCase();

export const sameName = (a, b) => normalize(a) === normalize(b);

const byLabel = (a, b) => a.label.localeCompare(b.label, 'es');

const addUnique = (options, value, label) => {
    const key = normalize(value);
    if (key && !options.has(key)) options.set(key, { value: String(value).trim(), label });
};

// Ventas, pedidos y compras guardan el nombre del producto, no su id. Los nombres
// que aparecen en esos registros y ya no están en el inventario también se ofrecen.
export const productNameOptions = (inventory, { type, extraNames = [] } = {}) => {
    const options = new Map();
    (inventory || [])
        .filter(product => !type || normalize(product.type || product.category) === normalize(type))
        .forEach(product => addUnique(options, product.name, type ? product.name : productLabel(product)));
    extraNames.forEach(name => addUnique(options, name, String(name || '').trim()));
    return [...options.values()].sort(byLabel);
};

export const productIdOptions = (inventory) =>
    (inventory || [])
        .map(product => ({ value: String(product.id), label: productLabel(product) }))
        .sort(byLabel);

export const nameOptions = (names) => {
    const options = new Map();
    (names || []).forEach(name => addUnique(options, name, String(name || '').trim()));
    return [...options.values()].sort(byLabel);
};
