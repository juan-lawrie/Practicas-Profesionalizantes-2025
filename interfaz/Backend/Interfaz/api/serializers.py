# backend/api/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Product, CashMovement, InventoryChange, Sale, SaleItem, Role

User = get_user_model()  # Usa el modelo de usuario personalizado

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'

# Serializer para el modelo de usuario (usando el modelo extendido)
class UserSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'is_active')
        read_only_fields = ('is_active',)  # El estado activo no se modifica por la API

# Serializer para crear usuarios (incluye el campo de contraseña)
class UserCreateSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'role_name')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        role_name = validated_data.pop('role_name', 'Cajero')
        
        # Buscar o crear el rol
        role, created = Role.objects.get_or_create(name=role_name)
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            role=role
        )
        return user

# Serializer para el modelo de producto
class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'
    
    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("El nombre del producto es obligatorio.")
        return value.strip()
    
    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("El precio debe ser mayor a 0.")
        return value
    
    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("El stock no puede ser negativo.")
        return value
    
    def validate_low_stock_threshold(self, value):
        if value < 0:
            raise serializers.ValidationError("El umbral de stock bajo no puede ser negativo.")
        return value
# Serializer para el modelo de movimiento de caja
class CashMovementSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.username')
    
    class Meta:
        model = CashMovement
        fields = '__all__'
        read_only_fields = ('user',)

# Serializer para el modelo de cambio de inventario
class InventoryChangeSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.username')
    
    class Meta:
        model = InventoryChange
        fields = '__all__'
        read_only_fields = ('user',)

# Serializer para los productos de una venta
class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source='product.name')
    
    class Meta:
        model = SaleItem
        fields = ('product', 'product_name', 'quantity', 'price')

# Serializer para el modelo de venta
class SaleSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source='user.username')
    items = serializers.ListField(write_only=True, required=False)  # Para recibir los items del frontend
    sale_items = SaleItemSerializer(source='saleitem_set', many=True, read_only=True)  # Para mostrar los items

    class Meta:
        model = Sale
        fields = ('id', 'timestamp', 'total_amount', 'payment_method', 'user', 'items', 'sale_items')
        read_only_fields = ('user',)

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        sale = Sale.objects.create(**validated_data)
        
        # Procesar cada item de la venta
        for item_data in items_data:
            product_id = item_data.get('product_id')
            quantity = item_data.get('quantity')
            price = item_data.get('price')
            
            try:
                product = Product.objects.get(id=product_id)
                
                # Verificar que hay suficiente stock
                if product.stock < quantity:
                    raise serializers.ValidationError(f'Stock insuficiente para {product.name}. Disponible: {product.stock}, Requerido: {quantity}')
                
                # Crear el item de venta
                SaleItem.objects.create(
                    sale=sale,
                    product=product,
                    quantity=quantity,
                    price=price
                )
                
                # Actualizar el stock del producto
                product.stock -= quantity
                product.save()
                
                print(f'✅ Stock actualizado: {product.name} - Nuevo stock: {product.stock}')
                
            except Product.DoesNotExist:
                raise serializers.ValidationError(f'Producto con ID {product_id} no encontrado')
        
        return sale