# backend/api/models.py
from django.db import models
from django.contrib.auth.models import AbstractUser

# Modelo para roles
class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    
    def __str__(self):
        return self.name

# Extender el modelo de usuario de Django para incluir roles
class User(AbstractUser):
    # Definimos los roles según los casos de uso
    ROLE_CHOICES = (
        ('Gerente', 'Gerente'),
        ('Encargado', 'Encargado'),
        ('Panadero', 'Panadero'),
        ('Cajero', 'Cajero'),
    )
    # Quitar default='Cajero' para que sea obligatorio
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    # Añadimos la columna `is_active` por defecto
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.username} - {self.role}"

# Modelo para los productos (eliminar la duplicación)
class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(default=10) # Umbral para la alerta de stock
    category = models.CharField(max_length=50, default='Producto') # Categoría del producto

    def __str__(self):
        return self.name

# Modelo para movimientos de caja
class CashMovement(models.Model):
    MOVEMENT_CHOICES = (
        ('Entrada', 'Entrada'),
        ('Salida', 'Salida'),
    )
    type = models.CharField(max_length=10, choices=MOVEMENT_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f'{self.type} de ${self.amount} - {self.timestamp.strftime("%Y-%m-%d %H:%M")}'

# Modelo para cambios de inventario (no por ventas)
class InventoryChange(models.Model):
    CHANGE_CHOICES = (
        ('Entrada', 'Entrada'),
        ('Salida', 'Salida'),
    )
    type = models.CharField(max_length=10, choices=CHANGE_CHOICES)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField()
    reason = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return f'{self.type} de {self.quantity} de {self.product.name}'

# Modelo para ventas
class Sale(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=50)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    products = models.ManyToManyField(Product, through='SaleItem')

    def __str__(self):
        return f'Venta #{self.id} - Total: ${self.total_amount}'

# Modelo intermedio para la relación Many-to-Many entre Sale y Product
class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f'{self.quantity} x {self.product.name} en Venta #{self.sale.id}'

# Modelo para guardar el estado de consultas de datos
class UserQuery(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    query_type = models.CharField(max_length=50)  # 'stock', 'ventas', 'compras', etc.
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    results_data = models.JSONField()  # Almacenar los resultados de la consulta
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)  # Para saber si la consulta está activa

    class Meta:
        ordering = ['-updated_at']
        unique_together = ['user', 'query_type']  # Un usuario solo puede tener una consulta activa por tipo

    def __str__(self):
        return f'{self.user.username} - {self.query_type} - {self.updated_at}'


# Modelo para almacenar compras (compras de insumos/proveedores)
class Purchase(models.Model):
    date = models.CharField(max_length=50, blank=True, null=True)
    supplier = models.CharField(max_length=255, blank=True, null=True)
    supplier_id = models.IntegerField(blank=True, null=True)
    items = models.JSONField(default=list)  # Lista de items con {productName, quantity, unitPrice, total}
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=50, default='Completada')
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Compra #{self.id} - {self.supplier or "(sin proveedor)"} - {self.created_at.strftime("%Y-%m-%d %H:%M")}'


# Modelos para pedidos de clientes (persistencia de orders)
class Order(models.Model):
    customer_name = models.CharField(max_length=255)
    date = models.DateField(null=True, blank=True)
    payment_method = models.CharField(max_length=100, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=50, default='Pendiente')
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Pedido #{self.id} - {self.customer_name} - {self.created_at.strftime("%Y-%m-%d %H:%M")}'


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product_name = models.CharField(max_length=255)
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f'{self.quantity} x {self.product_name} for Order #{self.order.id}'
    
    
