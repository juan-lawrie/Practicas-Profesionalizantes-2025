"""
URL configuration for Interfaz project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.urls import path, include 
from django.contrib import admin
from rest_framework.routers import DefaultRouter
from api.views import (
    UserViewSet, ProductViewSet, CashMovementViewSet, 
    InventoryChangeViewSet, SaleViewSet, SaleCreate,
    UserListCreate, UserDestroy, login_view, ExportDataView
)
from django.shortcuts import redirect

# Creamos un router para registrar nuestros ViewSets
router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'cash-movements', CashMovementViewSet, basename='cash-movement')
router.register(r'inventory-changes', InventoryChangeViewSet, basename='inventory-change')
router.register(r'sales', SaleViewSet, basename='sale')

def root_redirect(request):
    return redirect('/api/')

urlpatterns = [
    path('', root_redirect),
    path('admin/', admin.site.urls),
    # URLs específicas primero para evitar conflictos
    path('api/users/create/', UserListCreate.as_view(), name='user-list-create'),
    path('api/users/<int:pk>/delete/', UserDestroy.as_view(), name='user-delete'),
    path('api/sales/create/', SaleCreate.as_view(), name='sale-create'),
    path('api/auth/login/', login_view, name='login'),
    path('api/export-data/', ExportDataView.as_view(), name='export-data'),
    # Router general después
    path('api/', include(router.urls)),
]
