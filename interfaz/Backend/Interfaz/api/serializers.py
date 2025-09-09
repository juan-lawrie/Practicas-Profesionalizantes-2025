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
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'role', 'is_active')
        read_only_fields = ('is_active',)  # El estado activo no se modifica por la API

# Serializer para crear usuarios (incluye el campo de contraseña)
class UserCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'role')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            role=validated_data.get('role', 'Cajero')
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
    products = SaleItemSerializer(source='saleitem_set', many=True, read_only=True)

    class Meta:
        model = Sale
        fields = '__all__'
        read_only_fields = ('user',)

    def create(self, validated_data):
        sale_items_data = validated_data.pop('products', [])
        sale = Sale.objects.create(**validated_data)
        for item_data in sale_items_data:
            product = item_data['product']
            quantity = item_data['quantity']
            # Actualiza el stock del producto
            product.stock -= quantity
            product.save()
            SaleItem.objects.create(sale=sale, **item_data)
        return sale