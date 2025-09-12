# Generated manually for role migration
from django.db import migrations, models
import django.db.models.deletion


def create_roles(apps, schema_editor):
    """Crear los objetos Role iniciales"""
    Role = apps.get_model('api', 'Role')
    
    # Crear los roles básicos
    roles = ['Gerente', 'Encargado', 'Panadero', 'Cajero']
    for role_name in roles:
        Role.objects.get_or_create(name=role_name)


def migrate_user_roles(apps, schema_editor):
    """Migrar los datos de role (CharField) a role_new (ForeignKey)"""
    User = apps.get_model('api', 'User')
    Role = apps.get_model('api', 'Role')
    
    for user in User.objects.all():
        if user.role:  # Si el usuario tiene un role asignado
            try:
                # Buscar el objeto Role correspondiente
                role_obj = Role.objects.get(name=user.role)
                user.role_new = role_obj
                user.save()
            except Role.DoesNotExist:
                # Si no existe el rol, crear uno nuevo
                role_obj = Role.objects.create(name=user.role)
                user.role_new = role_obj
                user.save()


def reverse_migrate_user_roles(apps, schema_editor):
    """Reversar la migración de roles"""
    User = apps.get_model('api', 'User')
    
    for user in User.objects.all():
        if user.role_new:
            user.role = user.role_new.name
            user.save()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_product_category'),
    ]

    operations = [
        # Agregar campo temporal para el ForeignKey
        migrations.AddField(
            model_name='user',
            name='role_new',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='api.role'),
        ),
        # Crear los roles
        migrations.RunPython(create_roles, migrations.RunPython.noop),
        # Migrar los datos
        migrations.RunPython(migrate_user_roles, reverse_migrate_user_roles),
    ]
