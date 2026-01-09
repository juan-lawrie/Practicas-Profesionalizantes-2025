# Generated manually to register the already-existing field rename in the database
# This migration should be applied with --fake to avoid executing the SQL

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0036_fix_order_field_rename_and_recipe_decimals'),
    ]

    operations = [
        # Este rename ya existe en la base de datos, solo lo registramos
        migrations.RenameField(
            model_name='order',
            old_name='created_at',
            new_name='fecha_de_orden_del_pedido',
        ),
    ]
