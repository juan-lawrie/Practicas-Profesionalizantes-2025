from rest_framework import viewsets, status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Product, CashMovement, InventoryChange, Sale
from .serializers import (
    UserSerializer, UserCreateSerializer, ProductSerializer,
    CashMovementSerializer, InventoryChangeSerializer, SaleSerializer
)
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from django.http import HttpResponse
from io import BytesIO
import json

User = get_user_model()

# Vista de login mejorada
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Endpoint de autenticación.
    Espera JSON: {"email": "...", "password": "..."}
    Respuestas:
      200 OK   -> { success: true, user: {...}, tokens: {access, refresh} }
      400 Error de credenciales / datos faltantes
      403 Usuario inactivo
      500 Error interno inesperado
    """
    email = request.data.get('email')
    password = request.data.get('password')

    # Validación campos obligatorios
    if not email or not password:
        return Response({
            'success': False,
            'error': {
                'code': 'missing_fields',
                'message': 'Email y password son requeridos.'
            }
        }, status=status.HTTP_400_BAD_REQUEST)

    # Normalizamos email para búsqueda (case-insensitive)
    email_normalizado = email.strip().lower()

    try:
        user = User.objects.filter(email__iexact=email_normalizado).first()
        if not user:
            return Response({
                'success': False,
                'error': {
                    'code': 'user_not_found',
                    'message': 'Usuario no encontrado.'
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        if not user.is_active:
            return Response({
                'success': False,
                'error': {
                    'code': 'inactive',
                    'message': 'La cuenta está inactiva.'
                }
            }, status=status.HTTP_403_FORBIDDEN)

        if not user.check_password(password):
            return Response({
                'success': False,
                'error': {
                    'code': 'invalid_credentials',
                    'message': 'Credenciales inválidas.'
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        # Credenciales correctas -> generar tokens
        refresh = RefreshToken.for_user(user)
        role_name = user.role.name if getattr(user, 'role', None) else None

        return Response({
            'success': True,
            'user': {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'role': role_name
            },
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)
    except Exception as e:
        # Log simple para depuración (evitar exponer detalles sensibles)
        print(f"[login_view] Error inesperado: {e}")
        return Response({
            'success': False,
            'error': {
                'code': 'internal_error',
                'message': 'Error interno del servidor.'
            }
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ViewSet para la gestión de usuarios


class SaleCreate(generics.CreateAPIView):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer
class ProductListCreate(generics.ListCreateAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

class UserListCreate(generics.ListCreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]  # Permitir creación sin autenticación por ahora
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer
    
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

# Asegúrate de que ExportDataView esté definida solo aquí y no duplicada en urls.py
class ExportDataView(APIView):
    def post(self, request):
        try:
            data = request.data
            query_type = data.get('query_type')
            query_data = data.get('data', [])
            
            # Debug: imprimir datos recibidos
            print(f"Query type: {query_type}")
            print(f"Data received: {query_data}")
            
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4)
            story = []
            styles = getSampleStyleSheet()
            
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=16,
                spaceAfter=30,
                alignment=1
            )
            
            # Título más descriptivo
            title = Paragraph(f"Reporte de {query_type.replace('_', ' ').title()}", title_style)
            story.append(title)
            story.append(Spacer(1, 12))
            
            # Verificar si hay datos
            if not query_data:
                no_data_style = ParagraphStyle(
                    'NoData',
                    parent=styles['Normal'],
                    fontSize=12,
                    alignment=1
                )
                story.append(Paragraph("No hay datos disponibles para este reporte.", no_data_style))
            else:
                # Generar tabla según el tipo de consulta
                if query_type in ['inventario', 'stock']:
                    story.append(self._generate_inventory_table(query_data))
                elif query_type == 'ventas':
                    story.append(self._generate_sales_table(query_data))
                elif query_type in ['usuarios', 'users']:
                    story.append(self._generate_users_table(query_data))
                elif query_type == 'movimientos_caja':
                    story.append(self._generate_cash_movements_table(query_data))
                elif query_type == 'compras':
                    story.append(self._generate_purchases_table(query_data))
                elif query_type == 'pedidos':
                    story.append(self._generate_orders_table(query_data))
                elif query_type in ['proveedores', 'suppliers']:
                    story.append(self._generate_suppliers_table(query_data))
                else:
                    # Tabla genérica para tipos no reconocidos
                    story.append(self._generate_generic_table(query_data))
            
            doc.build(story)
            buffer.seek(0)
            response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="reporte_{query_type}.pdf"'
            return response
        except Exception as e:
            print(f"Error generating PDF: {str(e)}")
            return Response({'error': str(e)}, status=500)
        
        
    def _generate_inventory_table(self, data):
        table_data = [['Producto', 'Stock', 'Precio', 'Umbral']]
        for item in data:
            table_data.append([
                item.get('name', ''),
                str(item.get('stock', 0)),
                f"${item.get('price', 0)}",
                str(item.get('low_stock_threshold', 0))
            ])
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_sales_table(self, data):
        table_data = [['Fecha', 'Producto', 'Cantidad', 'Total']]
        for item in data:
            table_data.append([
                item.get('date', ''),
                item.get('product', ''),
                str(item.get('quantity', 0)),
                f"${item.get('total', 0)}"
            ])
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_users_table(self, data):
        table_data = [['Usuario', 'Email', 'Rol']]
        for item in data:
            table_data.append([
                item.get('username', '') or item.get('name', ''),
                item.get('email', ''),
                item.get('role', '')
            ])
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_cash_movements_table(self, data):
        table_data = [['Fecha', 'Tipo', 'Monto', 'Descripción']]
        for item in data:
            table_data.append([
                item.get('date', ''),
                item.get('type', ''),
                f"${item.get('amount', 0)}",
                item.get('description', '')
            ])
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_purchases_table(self, data):
        table_data = [['ID', 'Fecha', 'Proveedor', 'Total', 'Estado']]
        for item in data:
            table_data.append([
                item.get('id', ''),
                item.get('date', ''),
                item.get('supplier', ''),
                f"${item.get('total', 0)}" if item.get('total', None) is not None else f"${item.get('totalAmount', 0)}",
                item.get('status', '')
            ])
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_orders_table(self, data):
        table_data = [['ID', 'Fecha', 'Cliente', 'Método de Pago', 'Estado', 'Cantidad de Productos']]
        for item in data:
            table_data.append([
                item.get('id', ''),
                item.get('date', ''),
                item.get('cliente', ''),
                item.get('metodoPago', ''),
                item.get('status', ''),
                item.get('items', '')
            ])
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_suppliers_table(self, data):
        table_data = [['Nombre', 'CUIT', 'Teléfono', 'Dirección', 'Productos']]
        for item in data:
            table_data.append([
                item.get('name', ''),
                item.get('cuit', ''),
                item.get('phone', ''),
                item.get('address', ''),
                item.get('products', '')
            ])
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table

    def _generate_generic_table(self, data):
        if not data:
            return Paragraph("No hay datos disponibles.")
        
        # Obtener las claves del primer elemento para crear las columnas
        first_item = data[0] if data else {}
        headers = list(first_item.keys())
        
        table_data = [headers]
        for item in data:
            row = [str(item.get(key, '')) for key in headers]
            table_data.append(row)
        
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        return table