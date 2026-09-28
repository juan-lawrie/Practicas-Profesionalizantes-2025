export const suppliedProductIds = (supplier) =>
    (supplier?.supplied_products || []).map(id => Number(id));

export const supplierSells = (supplier, productId) =>
    suppliedProductIds(supplier).includes(Number(productId));

export const suppliersForProduct = (suppliers, productId) =>
    (suppliers || []).filter(supplier => supplierSells(supplier, productId));

export const productsForSuppliers = (inventory, suppliers, supplierIds) => {
    const selected = new Set((supplierIds || []).map(id => Number(id)));
    const productIds = new Set();
    (suppliers || []).forEach(supplier => {
        if (!selected.has(Number(supplier.id))) return;
        suppliedProductIds(supplier).forEach(id => productIds.add(id));
    });
    return (inventory || []).filter(product => productIds.has(Number(product.id)));
};

export const productLabel = (product) => {
    const kind = String(product.type || product.category || '').toLowerCase() === 'insumo' ? 'Insumo' : 'Producto';
    return `${product.name} (${kind})`;
};
