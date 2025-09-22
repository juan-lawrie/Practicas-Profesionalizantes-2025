from rest_framework import viewsets, status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model, authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Product, CashMovement, InventoryChange, Sale, UserQuery
from django.conf import settings
from .serializers import (
    UserSerializer, UserCreateSerializer, ProductSerializer,
    CashMovementSerializer, InventoryChangeSerializer, SaleSerializer,
    UserQuerySerializer
)
from .models import Purchase
from .serializers import PurchaseSerializer
from .models import Order
from .serializers import OrderSerializer
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from django.http import HttpResponse
from io import BytesIO
import json
from decimal import Decimal

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

        # Setear refresh token en cookie HttpOnly para cross-browser persistence
        response = Response({
            'success': True,
            'user': {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'role': role_name
            },
            'tokens': {
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)

        # Cookie segura para refresh token (HttpOnly) — duración según SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']
        # Determinar max_age a partir de settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'] si existe
        cookie_max_age = None
        try:
            rt = settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME')
            if hasattr(rt, 'total_seconds'):
                cookie_max_age = int(rt.total_seconds())
        except Exception:
            cookie_max_age = 7 * 24 * 60 * 60

        # Escribir cookie HttpOnly. En desarrollo no forzamos secure=True, pero en producción sí.
        # En desarrollo usamos proxy para que las peticiones sean same-site, dejar Lax.
        response.set_cookie(
            key='refresh_token',
            value=str(refresh),
            httponly=True,
            secure=not settings.DEBUG,
            samesite='Lax',
            max_age=cookie_max_age,
            path='/'
        )

        return response

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


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_from_cookie(request):
    """Endpoint que usa la cookie HttpOnly 'refresh_token' para devolver un nuevo access token."""
    refresh_token = request.COOKIES.get('refresh_token')
    if not refresh_token:
        # No cookie present — return 200 with access: None so frontend can handle without HTTP error
        response = Response({'access': None, 'detail': 'No refresh token cookie'}, status=status.HTTP_200_OK)
        response.delete_cookie('refresh_token', path='/')
        return response

    try:
        refresh = RefreshToken(refresh_token)

        # Intentar obtener el user_id del payload del refresh token y validar existencia/estado
        user_id = None
        try:
            user_id = refresh.payload.get('user_id')
        except Exception:
            try:
                user_id = refresh.get('user_id')
            except Exception:
                user_id = None

        if not user_id:
            response = Response({'access': None, 'detail': 'Refresh token inválido (sin usuario)'}, status=status.HTTP_200_OK)
            response.delete_cookie('refresh_token', path='/')
            return response

        # Validar existencia y estado del usuario antes de devolver access
        try:
            user = User.objects.get(pk=user_id)
            if not getattr(user, 'is_active', True):
                response = Response({'access': None, 'detail': 'Usuario inactivo'}, status=status.HTTP_200_OK)
                response.delete_cookie('refresh_token', path='/')
                return response
        except User.DoesNotExist:
            response = Response({'access': None, 'detail': 'Usuario no encontrado'}, status=status.HTTP_200_OK)
            response.delete_cookie('refresh_token', path='/')
            return response

        # Si el usuario existe y está activo, devolver access token y rol
        new_access = str(refresh.access_token)
        user_role = None
        try:
            user_role = user.role.name if user.role else None
        except Exception:
            user_role = None
        return Response({'access': new_access, 'role': user_role}, status=status.HTTP_200_OK)
    except Exception as e:
        print('[refresh_from_cookie] Error:', e)
        response = Response({'access': None, 'detail': 'Refresh token inválido o error interno'}, status=status.HTTP_200_OK)
        response.delete_cookie('refresh_token', path='/')
        return response


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    """Eliminar cookie de refresh en el cliente."""
    response = Response({'detail': 'Logged out'}, status=status.HTTP_200_OK)
    response.delete_cookie('refresh_token', path='/')
    return response

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


# ViewSet para compras
class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.all()
    serializer_class = PurchaseSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Asociar usuario si está autenticado y asegurar que total_amount se calcule correctamente
        # Calculamos el total a partir de los items si el cliente no lo proveyó o lo dejó en 0
        items = None
        try:
            items = serializer.validated_data.get('items')
        except Exception:
            # validated_data no disponible aún, intentar leer de request.data
            items = self.request.data.get('items')

        computed_total = Decimal('0')
        if items and isinstance(items, (list, tuple)):
            for item in items:
                # item puede venir con diferentes nombres de campo
                qty = item.get('quantity') or item.get('qty') or 0
                unit = item.get('unitPrice') or item.get('unit_price') or item.get('price') or 0
                item_total = item.get('total') if item.get('total') is not None else (item.get('totalAmount') if item.get('totalAmount') is not None else item.get('total_amount') if item.get('total_amount') is not None else None)
                try:
                    if item_total is not None:
                        item_total_dec = Decimal(str(item_total))
                    else:
                        item_total_dec = Decimal(str(qty)) * Decimal(str(unit))
                except Exception:
                    item_total_dec = Decimal('0')
                computed_total += item_total_dec

        # Revisar si el cliente proveyó un total válido
        provided_total = None
        try:
            provided_total = serializer.validated_data.get('total_amount')
        except Exception:
            provided_total = self.request.data.get('total_amount')

        provided_total_dec = None
        try:
            if provided_total is not None:
                provided_total_dec = Decimal(str(provided_total))
        except Exception:
            provided_total_dec = None

        final_total = provided_total_dec if (provided_total_dec is not None and provided_total_dec > 0) else computed_total

        try:
            serializer.save(user=self.request.user if self.request.user.is_authenticated else None, total_amount=final_total)
        except Exception as e:
            print(f"[PurchaseViewSet.perform_create] Error guardando compra: {e}")
            raise


# ViewSet para pedidos de clientes
class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        try:
            serializer.save(user=self.request.user if self.request.user.is_authenticated else None)
        except Exception as e:
            print(f"[OrderViewSet.perform_create] Error guardando pedido: {e}")
            raise
        # no fallback adicional aquí

# ViewSet para la gestión de movimientos de caja (CRUD)
class CashMovementViewSet(viewsets.ModelViewSet):
    queryset = CashMovement.objects.all()
    serializer_class = CashMovementSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        try:
            # Log minimal info for diagnostics (no token values)
            data = serializer.validated_data
            print(f"[CashMovementViewSet.perform_create] Creating movement user={self.request.user if self.request.user.is_authenticated else 'Anonymous'} type={data.get('type')} amount={data.get('amount')}")
        except Exception as e:
            print(f"[CashMovementViewSet.perform_create] Error reading validated_data: {e}")
        serializer.save(user=self.request.user)

    # Override list to add debug logging for incoming requests
    def list(self, request, *args, **kwargs):
        try:
            has_cookie = 'refresh_token' in request.COOKIES
            print(f"[CashMovementViewSet.list] Request received. user={request.user if request.user.is_authenticated else 'Anonymous'}, refresh_cookie_present={has_cookie}")
        except Exception as e:
            print(f"[CashMovementViewSet.list] Error checking cookies: {e}")
        return super().list(request, *args, **kwargs)

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
        # El serializer ya maneja la lógica de actualización de stock
        try:
            # Log minimal sale info for debugging
            incoming = serializer.validated_data
            total = incoming.get('total_amount')
            items = incoming.get('items')
            print(f"[SaleViewSet.perform_create] Creating sale user={self.request.user.username if self.request.user.is_authenticated else 'Anonymous'} total={total} items_count={len(items) if items else 0}")
        except Exception as e:
            print(f"[SaleViewSet.perform_create] Error reading validated_data: {e}")
        serializer.save(user=self.request.user)
        print(f'🛒 Venta registrada por usuario: {self.request.user.username}')

# ViewSet para la gestión de consultas de usuario
class UserQueryViewSet(viewsets.ModelViewSet):
    queryset = UserQuery.objects.all()
    serializer_class = UserQuerySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Solo mostrar las consultas del usuario actual
        qs = UserQuery.objects.filter(user=self.request.user)
        # Permitir filtrar por query_type desde query params (por ejemplo: ?query_type=ventas)
        qtype = self.request.query_params.get('query_type')
        if qtype:
            qs = qs.filter(query_type=qtype)
        return qs

    def perform_create(self, serializer):
        # Intentar crear de forma idempotente: si ya existe una consulta para (user, query_type)
        # actualizamos esa entrada en lugar de crear una nueva para evitar IntegrityError por la constraint única.
        qtype = serializer.validated_data.get('query_type')
        start_date = serializer.validated_data.get('start_date')
        end_date = serializer.validated_data.get('end_date')
        results_data = serializer.validated_data.get('results_data')

        existing = UserQuery.objects.filter(user=self.request.user, query_type=qtype).first()
        if existing:
            # Desactivar otras consultas del mismo tipo y usuario
            UserQuery.objects.filter(user=self.request.user, query_type=qtype).update(is_active=False)
            # Actualizar fields de la existente y marcar activa
            if start_date is not None:
                existing.start_date = start_date
            if end_date is not None:
                existing.end_date = end_date
            if results_data is not None:
                existing.results_data = results_data
            existing.is_active = True
            existing.save()
            return

        # Si no existe, proceder a crear y asegurar que las previas se desactiven
        UserQuery.objects.filter(user=self.request.user, query_type=qtype).update(is_active=False)
        serializer.save(user=self.request.user, is_active=True)

    @action(detail=False, methods=['get'])
    def active_query(self, request):
        """Obtener la consulta activa del usuario para cualquier tipo"""
        try:
            query = UserQuery.objects.filter(
                user=request.user,
                is_active=True
            ).first()
            
            if query:
                serializer = self.get_serializer(query)
                return Response(serializer.data)
            else:
                return Response({'message': 'No hay consulta activa'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def clear_active_query(self, request):
        """Limpiar la consulta activa del usuario"""
        try:
            UserQuery.objects.filter(
                user=request.user,
                is_active=True
            ).update(is_active=False)
            
            return Response({'message': 'Consulta activa limpiada'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        # Cambiado: mostrar columna de Productos y columna de Unidades (cantidades por producto)
        table_data = [['ID', 'Fecha', 'Cliente', 'Método de Pago', 'Estado', 'Productos', 'Unidades']]
        for item in data:
            # Soportar diferentes formas de nombrar campos (cliente/customer_name/customerName)
            cliente = item.get('cliente') or item.get('customer_name') or item.get('customerName') or item.get('customer') or ''
            metodo = item.get('metodoPago') or item.get('payment_method') or item.get('paymentMethod') or ''

            items_field = item.get('items')
            products_str = ''
            units_str = ''

            # Si items es una lista de objetos, construir listas de nombres y cantidades
            if isinstance(items_field, (list, tuple)):
                product_names = []
                quantities = []
                for it in items_field:
                    # soportar varias formas de nombrar campos dentro del item
                    name = (it.get('product_name') if isinstance(it, dict) else None) or (it.get('productName') if isinstance(it, dict) else None) or (it.get('product') if isinstance(it, dict) else None) or (it if isinstance(it, str) else '')
                    qty = ''
                    if isinstance(it, dict):
                        q = it.get('quantity') or it.get('qty') or it.get('units') or None
                        qty = str(q) if q is not None else ''
                    product_names.append(name or '')
                    quantities.append(qty)

                products_str = ', '.join([p for p in product_names if p])
                units_str = ', '.join([u for u in quantities if u])
            else:
                # items no es una lista: intentar inferir un número o string
                if isinstance(items_field, (int, float)):
                    products_str = ''
                    units_str = str(items_field)
                else:
                    products_str = str(items_field or '')
                    units_str = ''

            table_data.append([
                item.get('id', ''),
                item.get('date', ''),
                cliente,
                metodo,
                item.get('status', ''),
                products_str,
                units_str
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