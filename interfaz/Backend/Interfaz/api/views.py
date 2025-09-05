from rest_framework import viewsets, status, generics
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Product, CashMovement, InventoryChange, Sale, User
from .serializers import UserSerializer, UserCreateSerializer, ProductSerializer, CashMovementSerializer, InventoryChangeSerializer, SaleSerializer

User = get_user_model()

# Vista de login
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    email = request.data.get('email')
    password = request.data.get('password')
    
    try:
        # Intentar autenticar por email (no username)
        user = User.objects.get(email=email)
        if user.check_password(password):
            # Usuario autenticado correctamente
            refresh = RefreshToken.for_user(user)
            return Response({
                'success': True,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'role': user.role
                },
                'tokens': {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                }
            })
        else:
            return Response({
                'success': False,
                'error': 'Contraseña incorrecta'
            }, status=400)
    except User.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Usuario no encontrado'
        }, status=400)
    except Exception as e:
        return Response({
            'success': False,
            'error': f'Error interno: {str(e)}'
        }, status=500)

# ViewSet para la gestión de usuarios


class SaleCreate(generics.CreateAPIView):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
class ProductListCreate(generics.ListCreateAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

class UserListCreate(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
class UserDestroy(generics.DestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        # Permitir el registro de usuarios (create) a cualquiera por ahora, en un sistema real esto estaría restringido al Gerente
        if self.action == 'create':
            self.permission_classes = [AllowAny]
        else:
            self.permission_classes = [IsAuthenticated]
        return super(UserViewSet, self).get_permissions()
    
    def destroy(self, request, *args, **kwargs):
        # Excepción: un usuario no puede eliminarse a sí mismo
        instance = self.get_object()
        if request.user == instance:
            return Response(
                {"detail": "No puedes eliminar tu propia cuenta."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

# ViewSet para la gestión de productos (CRUD)
class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

# ViewSet para la gestión de movimientos de caja (CRUD)
class CashMovementViewSet(viewsets.ModelViewSet):
    queryset = CashMovement.objects.all()
    serializer_class = CashMovementSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

# ViewSet para la gestión de cambios de inventario (CRUD)
class InventoryChangeViewSet(viewsets.ModelViewSet):
    queryset = InventoryChange.objects.all()
    serializer_class = InventoryChangeSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Actualizamos el stock del producto al registrar el cambio
        product = serializer.validated_data['product']
        quantity = serializer.validated_data['quantity']
        change_type = serializer.validated_data['type']

        if change_type == 'Entrada':
            product.stock += quantity
        elif change_type == 'Salida':
            if product.stock < quantity:
                return Response(
                    {"detail": "La salida supera el stock disponible."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            product.stock -= quantity
        
        product.save()
        serializer.save(user=self.request.user)

# ViewSet para la gestión de ventas (CRUD)
class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Simplemente guardamos la venta, la lógica para descontar stock se haría en el frontend
        serializer.save(user=self.request.user)